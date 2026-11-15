import type {
  RemoteThreadInitializeResponse,
  RemoteThreadListAdapter,
  RemoteThreadListResponse,
  RemoteThreadMetadata,
  ThreadMessage,
} from '@assistant-ui/core';
import { createAssistantStream, type AssistantStream } from 'assistant-stream';

/** A thread seeded into {@link createScriptedThreadListAdapter}. */
export interface ScriptedThread {
  /** The thread's id (its remote id). */
  id: string;
  /** Its title. None by default (the list shows its fallback). */
  title?: string;
  /** `regular` (default) or `archived`. */
  status?: 'regular' | 'archived';
  /** Custom metadata. */
  custom?: Record<string, unknown>;
  /** When the thread last had a message (the styled list groups by it). */
  lastMessageAt?: Date;
}

/** Options for {@link createScriptedThreadListAdapter}. */
export interface ScriptedThreadListOptions {
  /** Threads to start with, listed in this order (newest first). Default none. */
  threads?: readonly ScriptedThread[];
  /**
   * The title `generateTitle` streams and stores for a thread, from its
   * messages. Without it the title stream is empty (as `InMemoryThreadListAdapter`).
   */
  title?: (messages: readonly ThreadMessage[], remoteId: string) => string;
}

/** The adapter methods {@link ScriptedThreadListAdapter.calls} records and `failNext` targets. */
export type ScriptedThreadListMethod =
  | 'list'
  | 'rename'
  | 'updateCustom'
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'initialize'
  | 'generateTitle'
  | 'fetch';

/** The adapter {@link createScriptedThreadListAdapter} returns. */
export interface ScriptedThreadListAdapter extends RemoteThreadListAdapter {
  /**
   * Every call, in order, with its arguments (`generateTitle` records the
   * remote id only, not the messages).
   */
  readonly calls: { method: ScriptedThreadListMethod; args: unknown[] }[];
  /** Makes the next call of `method` reject with `error`, once. */
  failNext(method: ScriptedThreadListMethod, error: Error): void;
}

class ScriptedThreadList implements ScriptedThreadListAdapter {
  readonly calls: { method: ScriptedThreadListMethod; args: unknown[] }[] = [];
  private readonly failures = new Map<ScriptedThreadListMethod, Error>();
  /** Threads in insertion order; `list` returns them newest-inserted first. */
  private readonly threads = new Map<string, RemoteThreadMetadata>();

  constructor(private readonly options: ScriptedThreadListOptions) {
    for (const thread of [...(options.threads ?? [])].reverse()) {
      this.threads.set(thread.id, {
        status: thread.status ?? 'regular',
        remoteId: thread.id,
        ...(thread.title !== undefined && { title: thread.title }),
        ...(thread.custom !== undefined && { custom: thread.custom }),
        ...(thread.lastMessageAt !== undefined && { lastMessageAt: thread.lastMessageAt }),
      });
    }
  }

  failNext(method: ScriptedThreadListMethod, error: Error): void {
    this.failures.set(method, error);
  }

  /** Records the call, then rejects once if a failure is scripted for it. */
  private async run<T>(
    method: ScriptedThreadListMethod,
    args: unknown[],
    call: () => T | Promise<T>,
  ): Promise<T> {
    this.calls.push({ method, args });
    const error = this.failures.get(method);
    if (error) {
      this.failures.delete(method);
      throw error;
    }
    return call();
  }

  private update(remoteId: string, change: Partial<RemoteThreadMetadata>, toFront = false): void {
    const thread = this.threads.get(remoteId);
    if (!thread) return;
    if (toFront) this.threads.delete(remoteId);
    this.threads.set(remoteId, { ...thread, ...change });
  }

  list(): Promise<RemoteThreadListResponse> {
    return this.run('list', [], () => ({ threads: [...this.threads.values()].reverse() }));
  }

  rename(remoteId: string, newTitle: string): Promise<void> {
    return this.run('rename', [remoteId, newTitle], () =>
      this.update(remoteId, { title: newTitle }),
    );
  }

  updateCustom(remoteId: string, custom: Record<string, unknown> | undefined): Promise<void> {
    return this.run('updateCustom', [remoteId, custom], () => this.update(remoteId, { custom }));
  }

  archive(remoteId: string): Promise<void> {
    return this.run('archive', [remoteId], () => {
      if (this.threads.get(remoteId)?.status !== 'archived') {
        this.update(remoteId, { status: 'archived' }, true);
      }
    });
  }

  unarchive(remoteId: string): Promise<void> {
    return this.run('unarchive', [remoteId], () => {
      if (this.threads.get(remoteId)?.status !== 'regular') {
        this.update(remoteId, { status: 'regular' }, true);
      }
    });
  }

  delete(remoteId: string): Promise<void> {
    return this.run('delete', [remoteId], () => {
      this.threads.delete(remoteId);
    });
  }

  initialize(
    threadId: string,
    init?: { custom?: Record<string, unknown> | undefined },
  ): Promise<RemoteThreadInitializeResponse> {
    return this.run('initialize', init ? [threadId, init] : [threadId], () => {
      if (!this.threads.has(threadId)) {
        this.threads.set(threadId, {
          status: 'regular',
          remoteId: threadId,
          ...(init?.custom !== undefined && { custom: init.custom }),
        });
      }
      return { remoteId: threadId, externalId: undefined };
    });
  }

  generateTitle(remoteId: string, messages: readonly ThreadMessage[]): Promise<AssistantStream> {
    return this.run('generateTitle', [remoteId], () => {
      const text = this.options.title?.(messages, remoteId);
      if (text !== undefined) this.update(remoteId, { title: text });
      return createAssistantStream((controller) => {
        if (text) controller.appendText(text);
      });
    });
  }

  fetch(threadId: string): Promise<RemoteThreadMetadata> {
    return this.run('fetch', [threadId], () => {
      const thread = this.threads.get(threadId);
      if (!thread) throw new Error(`Thread "${threadId}" not found in the scripted thread list.`);
      return thread;
    });
  }
}

/**
 * An in-memory `RemoteThreadListAdapter` for tests and demos, seeded with
 * threads (titles, archived threads, custom metadata, last-message dates) and
 * an optional scripted title generator. It keeps the semantics of core's
 * `InMemoryThreadListAdapter` (new threads list first, archive and unarchive
 * move a thread to the front) and records every call in `calls`; `failNext`
 * makes one call reject, for error-path tests.
 *
 * Use it wherever a thread-list adapter is accepted, for example
 * `remoteThreadListConfig({ adapter, runtime })` or `MastraThreads({ adapter, ... })`.
 * It holds thread metadata only; each thread's messages come from its runtime.
 *
 * @example
 * ```ts
 * const adapter = createScriptedThreadListAdapter({
 *   threads: [
 *     { id: 'today', title: 'Trip to Paris', lastMessageAt: new Date() },
 *     { id: 'old', title: 'Archived chat', status: 'archived' },
 *   ],
 *   title: (messages) => `Chat (${messages.length} messages)`,
 * });
 * ```
 */
export function createScriptedThreadListAdapter(
  options: ScriptedThreadListOptions = {},
): ScriptedThreadListAdapter {
  return new ScriptedThreadList(options);
}
