// Ported from packages/core/src/react/runtimes/assistant-transport/useAssistantTransportRuntime.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/runtimes/assistant-transport/commandQueue.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/runtimes/assistant-transport/runManager.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/runtimes/assistant-transport/replayBoundaryStream.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the ambient types must reach the ng-packagr build, which only compiles files reachable from the entry
/// <reference path="./tap-react-shim.d.ts" />
import { assertInInjectionContext, computed, type Signal } from '@angular/core';
import {
  InMemoryThreadListAdapter,
  createRequestHeaders,
  type AddToolResultOptions,
  type AppendMessage,
  type RemoteThreadListAdapter,
  type ThreadMessage,
  type ThreadMessageLike,
  type ToolExecutionStatus,
  type UserExternalState,
} from '@assistant-ui/core';
import {
  AssistantRuntimeImpl,
  ExternalStoreRuntimeCore,
  generateId,
  invokeUserCallback,
  raceWithAbortSignal,
} from '@assistant-ui/core/internal';
import { RemoteThreadList, createRuntimeExtrasBrand } from '@assistant-ui/core/store';
import { ThreadClient } from '@assistant-ui/core/store/internal';
import type {
  AssistantTransportCommand,
  AssistantTransportOptions,
  SendCommandsRequestBody,
} from '@assistant-ui/core/react';
import { AuiConfig, useAssistantClientRef } from '@assistant-ui/store/client';
import { resource, useResource, withKey } from '@assistant-ui/tap';
import { useEffect, useState } from '@assistant-ui/tap/react-shim';
import {
  AssistantMessageAccumulator,
  AssistantTransportDecoder,
  DataStreamDecoder,
  toToolsJSONSchema,
  unstable_createInitialMessage as createInitialMessage,
} from 'assistant-stream';
import { asAsyncIterableStream, type ReadonlyJSONValue } from 'assistant-stream/utils';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';

type AddMessageCommand = Extract<AssistantTransportCommand, { type: 'add-message' }>;
type AddToolResultCommand = Extract<AssistantTransportCommand, { type: 'add-tool-result' }>;
type UserMessagePart = Extract<AddMessageCommand['message'], { role: 'user' }>['parts'][number];
type QueuedCommand = AssistantTransportCommand;

/**
 * Options of {@link createAssistantTransportRuntime}: React's
 * `AssistantTransportOptions` without the Assistant Cloud `cloud` option
 * (Assistant Cloud is out of scope).
 */
export type AssistantTransportRuntimeOptions<T> = Omit<AssistantTransportOptions<T>, 'cloud'>;

/** What {@link createAssistantTransportRuntime} returns. */
export interface AssistantTransportRuntime<T> {
  /**
   * The config for `[auiProvider]`: a thread list (by default in memory) whose
   * every thread runs its own transport runtime. Each thread gets its own id,
   * which is posted as `threadId`.
   */
  readonly config: AuiConfig;
  /** Replaces the options (for example a new `converter` or `headers`) on every thread. */
  update(options: AssistantTransportRuntimeOptions<T>): void;
  /** Aborts every thread's current run and detaches them. */
  destroy(): void;
}

interface TransportExtras {
  sendCommand: (command: AssistantTransportCommand) => void;
  state: UserExternalState;
}

const transportExtras = createRuntimeExtrasBrand<TransportExtras>(
  'createAssistantTransportRuntime',
);

const convertAppendMessageToCommand = (message: AppendMessage): AddMessageCommand | null => {
  if (message.role !== 'user') throw new Error('Only user messages are supported');

  const parts: UserMessagePart[] = [];
  const content = [...message.content, ...(message.attachments?.flatMap((a) => a.content) ?? [])];
  for (const contentPart of content) {
    if (contentPart.type === 'text') parts.push({ type: 'text', text: contentPart.text });
    else if (contentPart.type === 'image') parts.push({ type: 'image', image: contentPart.image });
  }
  if (parts.length === 0) return null;

  return {
    type: 'add-message',
    message: { role: 'user', id: generateId(), parts },
    parentId: message.parentId,
    sourceId: message.sourceId,
  };
};

const readResumeState = async <T>(
  response: Response,
): Promise<{ runId: string; state: T } | null> => {
  if (response.status === 204) return null;
  if (!response.ok) {
    throw new Error(
      `Resume state request failed with status ${response.status}: ${await response.text()}`,
    );
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('Resume state response was not valid JSON');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('state' in value) ||
    !('runId' in value) ||
    typeof value.runId !== 'string'
  ) {
    throw new Error('Resume state response must contain state and runId');
  }
  return { runId: value.runId, state: value.state as T };
};

/** @internal Exported for specs. */
export const REPLAY_CONTENT_LENGTH_HEADER = 'Aui-Replay-Content-Length';

/**
 * One macrotask: lets replayed state render before live bytes are released.
 * Weaker than upstream's render-commit wait (a ticket resolved once React
 * commits); Angular offers no equivalent hook for a plain function.
 */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Gates replay bytes until isReplaying:true is published, then releases live
// bytes after isReplaying:false is published.
export const createReplayBoundaryStream = async (
  response: Response,
  {
    setReplaying,
    waitForRender,
  }: { setReplaying: (value: boolean) => void; waitForRender: () => Promise<void> },
): Promise<ReadableStream<Uint8Array>> => {
  const body = response.body as ReadableStream<Uint8Array>;
  const raw = response.headers.get(REPLAY_CONTENT_LENGTH_HEADER);
  const boundary = raw == null ? 0 : Number(raw);
  const replayContentLength = Number.isSafeInteger(boundary) && boundary > 0 ? boundary : 0;
  if (replayContentLength <= 0) return body;

  setReplaying(true);
  await waitForRender();

  const reader = body.getReader();
  let bytesForwarded = 0;
  let replayFinished = false;
  let replayCleared = false;
  let readerCleanup: Promise<void> | undefined;

  const clearReplay = () => {
    if (replayCleared) return;
    replayCleared = true;
    setReplaying(false);
  };
  const releaseReader = () => {
    if (readerCleanup) return readerCleanup;
    reader.releaseLock();
    readerCleanup = Promise.resolve();
    return readerCleanup;
  };
  const cancelReader = (reason?: unknown) => {
    if (readerCleanup) return readerCleanup;
    readerCleanup = (async () => {
      try {
        await reader.cancel(reason);
      } finally {
        reader.releaseLock();
      }
    })();
    return readerCleanup;
  };
  const finishReplay = async () => {
    if (replayFinished) return;
    replayFinished = true;
    await waitForRender();
    clearReplay();
    await waitForRender();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          await releaseReader();
          await finishReplay();
          controller.close();
          return;
        }
        if (replayFinished) {
          controller.enqueue(value);
          return;
        }
        const next = bytesForwarded + value.byteLength;
        if (next < replayContentLength) {
          bytesForwarded = next;
          controller.enqueue(value);
          return;
        }
        if (next === replayContentLength) {
          controller.enqueue(value);
          await finishReplay();
          return;
        }
        const replayBytesInChunk = replayContentLength - bytesForwarded;
        controller.enqueue(value.subarray(0, replayBytesInChunk));
        await finishReplay();
        controller.enqueue(value.subarray(replayBytesInChunk));
      } catch (error) {
        clearReplay();
        await cancelReader(error).catch(() => undefined);
        throw error;
      }
    },
    async cancel(reason) {
      const wasFinished = replayFinished;
      replayFinished = true;
      if (!wasFinished) clearReplay();
      await cancelReader(reason);
    },
  });
};

const disposeReason = Symbol('assistant-transport-dispose');

interface ThreadItemHandle {
  getState(): { remoteId?: string | undefined };
  initialize(): Promise<{ remoteId: string }>;
}

/** One thread's transport runtime. */
function createTransportThread<T>(
  getOptions: () => AssistantTransportRuntimeOptions<T>,
  getThreadItem: () => ThreadItemHandle,
) {
  let agentState = getOptions().initialState;
  let queue: { queued: QueuedCommand[]; inTransit: QueuedCommand[] } = {
    queued: [],
    inTransit: [],
  };
  let isReplaying = false;
  let toolStatuses: Record<string, ToolExecutionStatus> = {};
  let resumeFlag = false;
  let parentId: string | null | undefined;
  let cancelledCommands: QueuedCommand[] = [];
  let disposed = false;

  // --- run manager ---
  let isRunning = false;
  let pending = false;
  let abortController: AbortController | null = null;

  const publish = () => {
    if (!disposed) core.setAdapter(buildAdapter());
  };

  const updateState = (updater: (state: T) => T) => {
    agentState = updater(agentState);
    publish();
  };

  const startRun = () => {
    isRunning = true;
    pending = false;
    const ac = new AbortController();
    abortController = ac;
    publish();
    const disposeAborted = () => ac.signal.reason === disposeReason;

    queueMicrotask(async () => {
      try {
        if (ac.signal.aborted) throw ac.signal.reason;
        if (!disposed) {
          await onRun(ac.signal);
          if (ac.signal.aborted) throw ac.signal.reason;
        }
      } catch (error) {
        if (!disposeAborted() && !disposed) {
          if (ac.signal.aborted) {
            void invokeUserCallback('assistant-ui', 'Assistant transport onCancel', () =>
              onCancel(false),
            );
          } else {
            pending = false;
            await raceWithAbortSignal(ac.signal, async () =>
              invokeUserCallback('assistant-ui', 'Assistant transport onError', () =>
                onError(error as Error),
              ),
            ).catch(() => undefined);
            if (ac.signal.aborted && !disposeAborted() && !disposed) {
              void invokeUserCallback('assistant-ui', 'Assistant transport onCancel', () =>
                onCancel(true),
              );
            }
          }
        }
      } finally {
        if (!disposeAborted() && !disposed) {
          void invokeUserCallback(
            'assistant-ui',
            'Assistant transport onFinish',
            getOptions().onFinish,
          );
        }
        if (!disposed && pending) {
          startRun();
        } else {
          isRunning = false;
          if (abortController === ac) abortController = null;
          publish();
        }
      }
    });
  };

  const schedule = () => {
    if (disposed) return;
    if (abortController) {
      // Coalesce multiple schedules while running into a single follow-up run.
      pending = true;
      return;
    }
    startRun();
  };

  const cancelRun = (): boolean => {
    pending = false;
    const ac = abortController;
    ac?.abort();
    return ac !== null;
  };

  // --- command queue ---
  const enqueue = (command: QueuedCommand, enqueueOptions?: { schedule?: boolean }) => {
    queue = { queued: [...queue.queued, command], inTransit: queue.inTransit };
    publish();
    if (enqueueOptions?.schedule !== false) schedule();
  };
  const flush = (): QueuedCommand[] => {
    if (queue.queued.length === 0) return [];
    const queued = queue.queued;
    queue = { queued: [], inTransit: [...queue.inTransit, ...queued] };
    publish();
    return queued;
  };
  const markDelivered = () => {
    queue = { ...queue, inTransit: [] };
    publish();
  };
  const resetQueue = () => {
    queue = { queued: [], inTransit: [] };
    publish();
  };

  const enqueueAppendMessage = (message: AppendMessage) => {
    const command = convertAppendMessageToCommand(message);
    if (!command) {
      console.warn('[assistant-ui] Skipped add-message command with no supported parts');
      return;
    }
    parentId = message.parentId;
    enqueue(command, { schedule: message.startRun ?? message.role === 'user' });
  };

  // --- run ---
  const onRun = async (signal: AbortSignal): Promise<void> => {
    const options = getOptions();
    const isResume = resumeFlag;
    resumeFlag = false;
    isReplaying = false;
    const commands: QueuedCommand[] = isResume ? [] : flush();
    if (commands.length === 0 && !isResume) return;

    // The flushed batch consumes the parentId; read it alongside the flush
    // (before any awaits) so a mid-run append keeps its own value.
    const runParentId = isResume ? undefined : parentId;
    if (!isResume) parentId = undefined;

    const mainItem = getThreadItem();
    const threadId =
      mainItem.getState().remoteId ??
      (isResume
        ? undefined
        : (await raceWithAbortSignal(signal, () => mainItem.initialize())).remoteId);

    const headers = await raceWithAbortSignal(signal, () => createRequestHeaders(options.headers));
    let resumeState: { runId: string; state: T } | undefined;
    if (isResume && options.resumeStateApi) {
      const resumeStateResponse = await fetch(options.resumeStateApi, {
        method: 'POST',
        headers,
        body: JSON.stringify({ threadId }),
        signal,
      });
      const retained = await readResumeState<T>(resumeStateResponse);
      if (retained === null) {
        if (queue.queued.length > 0) schedule();
        return;
      }
      resumeState = retained;
    }

    const bodyValue: object | undefined = await raceWithAbortSignal(signal, () =>
      typeof options.body === 'function' ? options.body() : options.body,
    );
    const context = runtime.thread.getModelContext();

    const sendCommandsBody: SendCommandsRequestBody = {
      commands,
      ...(resumeState === undefined && { state: agentState }),
      system: context.system,
      tools: context.tools ? toToolsJSONSchema(context.tools) : undefined,
      ...(threadId !== undefined && { threadId }),
      ...(runParentId !== undefined && { parentId: runParentId }),
      callSettings: context.callSettings,
      config: context.config,
      ...context.callSettings,
      ...context.config,
      ...(bodyValue ?? {}),
    };

    let requestBody: Record<string, unknown> = sendCommandsBody;
    if (options.prepareSendCommandsRequest) {
      requestBody = await raceWithAbortSignal(signal, () =>
        options.prepareSendCommandsRequest!(sendCommandsBody),
      );
    }
    if (resumeState !== undefined) {
      // The server replays a resume from the snapshot it retained for this
      // runId. Body overrides and prepare hooks can neither substitute a
      // state nor drop the ID the server validates against.
      requestBody = { ...requestBody, runId: resumeState.runId };
      delete requestBody['state'];
    }

    const response = await fetch(isResume ? options.resumeApi! : options.api, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    try {
      await raceWithAbortSignal(signal, () => options.onResponse?.(response));
    } catch (error) {
      void response.body?.cancel().catch(() => undefined);
      throw error;
    }
    if (!response.ok) throw new Error(`Status ${response.status}: ${await response.text()}`);
    if (!response.body) throw new Error('Response body is null');

    if (resumeState !== undefined) {
      agentState = resumeState.state;
      publish();
    }

    const body = await createReplayBoundaryStream(response, {
      setReplaying: (value) => {
        isReplaying = value;
        publish();
      },
      waitForRender: () => raceWithAbortSignal(signal, nextTask),
    });

    const protocol = options.protocol ?? 'data-stream';
    // Resume replays a best-effort buffer; always reconcile leniently.
    const strict = isResume ? false : (options.strict ?? true);
    const decoder =
      protocol === 'assistant-transport'
        ? new AssistantTransportDecoder({
            strict,
            maxLineLength: options.maxStreamLineLength,
            maxEventLength: options.maxStreamEventLength,
          })
        : new DataStreamDecoder({ strict, maxLineLength: options.maxStreamLineLength });

    let err: string | undefined;
    const stream = body.pipeThrough(decoder).pipeThrough(
      new AssistantMessageAccumulator({
        initialMessage: createInitialMessage({
          unstable_state: (agentState as ReadonlyJSONValue) ?? null,
        }),
        throttle: isResume,
        strict,
        onError: (error) => {
          err = error;
        },
      }),
    );

    let markedDelivered = false;
    for await (const chunk of asAsyncIterableStream(stream)) {
      // abort() cannot error a body that has fully arrived.
      if (signal.aborted) throw signal.reason;
      if (chunk.metadata.unstable_state === agentState) continue;
      if (!markedDelivered) {
        markDelivered();
        markedDelivered = true;
      }
      agentState = chunk.metadata.unstable_state as T;
      publish();
    }

    if (err) throw new Error(err);
    // A successful run confirms delivery even when no state-changing chunk was observed.
    if (!markedDelivered) markDelivered();
    // Commands that coalesced into this resume run must not starve.
    if (isResume && queue.queued.length > 0) schedule();
  };

  const onCancel = (afterError: boolean) => {
    isReplaying = false;
    const cmds = cancelledCommands;
    cancelledCommands = [];
    if (afterError && cmds.length === 0) return;
    getOptions().onCancel?.({ commands: cmds, updateState });
  };

  const onError = async (error: Error) => {
    resumeFlag = false;
    isReplaying = false;
    const inTransitCmds = [...queue.inTransit];
    const queuedCmds = [...queue.queued];
    resetQueue();
    parentId = undefined;
    try {
      await getOptions().onError?.(error, { commands: inTransitCmds, updateState });
    } finally {
      getOptions().onCancel?.({ commands: queuedCmds, updateState, error });
    }
  };

  const sendCommand = (command: AssistantTransportCommand) => {
    enqueue(
      command.type === 'add-message' && command.message.role === 'user'
        ? { ...command, message: { ...command.message, id: command.message.id ?? generateId() } }
        : command,
    );
  };

  // --- adapter ---
  const buildAdapter = () => {
    const pendingCommands = [...queue.inTransit, ...queue.queued];
    const converted = getOptions().converter(agentState, {
      pendingCommands,
      isSending: isRunning,
      toolStatuses,
    });
    const pendingIds = new Set(
      pendingCommands.flatMap((command) =>
        command.type === 'add-message' && command.message.role === 'user' && command.message.id
          ? [command.message.id]
          : [],
      ),
    );
    const messages: readonly ThreadMessage[] = converted.messages.some((m) => pendingIds.has(m.id))
      ? converted.messages.map((m) =>
          pendingIds.has(m.id)
            ? ({ ...m, metadata: { ...m.metadata, isOptimistic: true } } as ThreadMessage)
            : m,
        )
      : converted.messages;

    return {
      messages: messages as ThreadMessageLike[],
      state: converted.state,
      isRunning: converted.isRunning,
      canResume: !!getOptions().canResume && !!getOptions().resumeApi && !isRunning,
      isLoading: isReplaying,
      adapters: getOptions().adapters,
      unstable_enableToolInvocations: true,
      setToolStatuses: (statuses: Record<string, ToolExecutionStatus>) => {
        toolStatuses = statuses;
        publish();
      },
      extras: transportExtras.provide({
        sendCommand,
        state: agentState as UserExternalState,
      }),
      onNew: async (message: AppendMessage): Promise<void> => enqueueAppendMessage(message),
      ...(getOptions().capabilities?.edit && {
        onEdit: async (message: AppendMessage): Promise<void> => enqueueAppendMessage(message),
      }),
      ...(queue.queued.length > 0 && {
        onReload: async (reloadParentId: string | null) => {
          parentId = reloadParentId;
          schedule();
        },
      }),
      onCancel: async () => {
        resumeFlag = false;
        if (!cancelRun()) return;
        cancelledCommands.push(...queue.inTransit, ...queue.queued);
        resetQueue();
        parentId = undefined;
      },
      onResume: async () => {
        if (!getOptions().resumeApi)
          throw new Error('Must pass resumeApi to options to resume runs');
        resumeFlag = true;
        schedule();
      },
      onAddToolResult: async (toolOptions: AddToolResultOptions): Promise<void> => {
        const command: AddToolResultCommand = {
          type: 'add-tool-result',
          toolCallId: toolOptions.toolCallId,
          result: toolOptions.result as ReadonlyJSONValue,
          toolName: toolOptions.toolName,
          isError: toolOptions.isError,
          ...(toolOptions.artifact !== undefined && { artifact: toolOptions.artifact }),
          ...(toolOptions.modelContent !== undefined && { modelContent: toolOptions.modelContent }),
        };
        enqueue(command);
      },
      onLoadExternalState: async (state: unknown) => {
        agentState = state as T;
        publish();
      },
    };
  };

  const core = new ExternalStoreRuntimeCore(buildAdapter() as never);
  const runtime = new AssistantRuntimeImpl(core);

  return {
    core,
    runtime,
    sendCommand,
    publish,
    getState: () => agentState,
    // Tap's development strict mode mounts, unmounts and re-mounts a body, so
    // a destroyed host must be able to come back (as upstream's run manager does).
    revive: () => {
      disposed = false;
    },
    destroy: () => {
      if (disposed) return;
      pending = false;
      disposed = true;
      abortController?.abort(disposeReason);
    },
  };
}

interface TransportShared<T> {
  getOptions: () => AssistantTransportRuntimeOptions<T>;
  hosts: Set<{ publish: () => void; destroy: () => void }>;
  /** Set by `destroy()`: threads mounted afterwards stay disposed. */
  destroyed: boolean;
}

/** The per-thread body: the transport runtime wired to the thread list client. */
const TransportThread = resource(function useTransportThread<T>({
  shared,
}: {
  shared: TransportShared<T>;
}) {
  const clientRef = useAssistantClientRef();
  const [host] = useState(() =>
    createTransportThread<T>(shared.getOptions, () => clientRef.current!.threadListItem()),
  );
  useEffect(() => {
    if (shared.destroyed) {
      host.destroy();
      return undefined;
    }
    host.revive();
    shared.hosts.add(host);
    // Tools and instructions registered in the client's model context reach
    // this thread's runtime (and its tool invocations).
    const off = host.core.registerModelContextProvider(clientRef.current!.modelContext());
    return () => {
      off();
      shared.hosts.delete(host);
      host.destroy();
    };
  }, [host, shared, clientRef]);
  return useResource(ThreadClient({ runtime: host.runtime.thread }));
});

/**
 * Creates the runtime config for a server that owns the agent state and
 * streams state updates back (React's `useAssistantTransportRuntime`, without
 * Assistant Cloud). Commands (`add-message`, `add-tool-result`, your own) are
 * queued and posted to `options.api`; the streamed state is turned into
 * messages by `options.converter`.
 *
 * As upstream does, the threads live in a thread list (an
 * `InMemoryThreadListAdapter` unless you pass `adapter`), and each thread runs
 * its own transport runtime. The thread's id is posted as `threadId`; new
 * thread and thread switching work out of the box.
 *
 * Read the agent state with {@link injectAssistantTransportState} and queue
 * commands with {@link injectAssistantTransportSendCommand}.
 *
 * @alpha This is an experimental API that is subject to change.
 *
 * @example
 * ```ts
 * const transport = createAssistantTransportRuntime({
 *   api: '/api/agent',
 *   initialState: { messages: [] },
 *   headers: {},
 *   converter: (state, { isSending }) => ({ messages: state.messages, isRunning: isSending }),
 * });
 * // <ng-container [auiProvider]="transport.config">
 * ```
 */
export function createAssistantTransportRuntime<T>(
  initialOptions: AssistantTransportRuntimeOptions<T>,
  threadList: { adapter?: RemoteThreadListAdapter } = {},
): AssistantTransportRuntime<T> {
  let options = initialOptions;
  const shared: TransportShared<T> = {
    getOptions: () => options,
    hosts: new Set(),
    destroyed: false,
  };
  const adapter = threadList.adapter ?? new InMemoryThreadListAdapter();
  return {
    config: AuiConfig({
      threads: RemoteThreadList({
        adapter,
        // As upstream: every visited thread stays mounted, so its agent state and
        // running request survive a switch to another thread.
        backgroundThreads: true,
        thread: (threadId) => withKey(threadId, TransportThread({ shared })),
      }),
    }),
    update: (next) => {
      options = next;
      for (const host of shared.hosts) host.publish();
    },
    destroy: () => {
      shared.destroyed = true;
      for (const host of [...shared.hosts]) host.destroy();
    },
  };
}

/**
 * Returns a function that queues a command on the nearest provider's assistant
 * transport runtime (React's `useAssistantTransportSendCommand`). Must be called
 * in an injection context under a provider mounting a runtime from
 * {@link createAssistantTransportRuntime}.
 */
export function injectAssistantTransportSendCommand(): (
  command: AssistantTransportCommand,
) => void {
  assertInInjectionContext(injectAssistantTransportSendCommand);
  const aui = injectAui();
  return (command) => transportExtras.assert(aui.thread().getState().extras).sendCommand(command);
}

/**
 * The agent state of the nearest assistant transport runtime as a signal
 * (React's `useAssistantTransportState`); pass a selector to read a slice.
 */
export function injectAssistantTransportState(): Signal<UserExternalState>;
export function injectAssistantTransportState<S>(
  select: (state: UserExternalState) => S,
): Signal<S>;
export function injectAssistantTransportState<S>(
  select?: (state: UserExternalState) => S,
): Signal<S | UserExternalState> {
  assertInInjectionContext(injectAssistantTransportState);
  const extras = injectAuiState((s) => s.thread.extras);
  return computed(() => {
    const current = transportExtras.tryGet(extras());
    if (!current) {
      throw new Error(
        'injectAssistantTransportState requires a runtime created with createAssistantTransportRuntime.',
      );
    }
    return select ? select(current.state) : current.state;
  });
}
