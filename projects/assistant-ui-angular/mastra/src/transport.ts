import { AssistantChatTransport } from '@assistant-ui/ai-sdk';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { resolveMastraAuth, type MastraAuth } from './auth.token';
import {
  authHeaders,
  buildChatBody,
  chatUrl,
  clearStoredIds,
  getStoredIds,
  setStoredIds,
  storedIdsAfterRun,
  type MastraChatBody,
  type MastraEndpoint,
  type MastraToolSchema,
} from './contract';

/** Options for {@link createMastraTransport}. */
export interface MastraTransportOptions {
  /**
   * Mastra server origin (and optional path prefix), e.g. `http://localhost:4111`. Use the same
   * string as the thread-list adapter's `baseUrl`: the stored-id record is keyed by it.
   */
  api: string;
  /** Agent to chat with, e.g. `chatAgent`. The chat route is `<api>/chat/<agentId>`. */
  agentId: string;
  /** Auth headers. Defaults to the provided `MASTRA_AUTH` when created in an injection context. */
  auth?: MastraAuth;
  /**
   * Frontend tools (from the model context) sent to the server, which offers them to the model
   * as client tools. `false` sends none; a function filters or rewrites them. Names must not
   * collide with server tools: the server silently drops such a tool (and any name that is not
   * `[A-Za-z0-9_-]{1,64}`), and uses at most 64.
   */
  tools?: false | ((tools: Record<string, MastraToolSchema>) => Record<string, MastraToolSchema>);
  /** Custom `fetch` (defaults to `globalThis.fetch` at call time). */
  fetch?: typeof fetch;
}

const REQUEST_KEY = '__mastraRequest';

interface PendingRequest {
  threadId: string;
  body: MastraChatBody;
}

interface TransportState {
  options: MastraTransportOptions;
  endpoint: MastraEndpoint;
  pending: Map<number, PendingRequest>;
  nextRequest: number;
}

const createState = (options: MastraTransportOptions): TransportState => ({
  options,
  endpoint: { baseUrl: options.api, agentId: options.agentId },
  pending: new Map(),
  nextRequest: 0,
});

const pickRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/**
 * The AI SDK transport for the Mastra chat route; build it with {@link createMastraTransport}.
 * It is an `AssistantChatTransport`, so assistant-ui wires it to the thread (remote thread id,
 * model-context tools).
 */
export class MastraChatTransport extends AssistantChatTransport<UIMessage> {
  private mastra!: TransportState;

  /** @param options See {@link MastraTransportOptions}. */
  constructor(options: MastraTransportOptions) {
    const state = createState(options);
    const auth = resolveMastraAuth(options.auth);
    if (auth) state.options = { ...options, auth };
    super({
      api: chatUrl(state.endpoint),
      headers: () => authHeaders(state.options.auth),
      ...(auth?.credentials && { credentials: auth.credentials }),
      ...(options.fetch && { fetch: options.fetch }),
      prepareSendMessagesRequest: (request) => {
        const extra = request.body ?? {};
        const threadId = request.id;
        const toolOption = state.options.tools;
        const modelTools = (pickRecord(extra['tools']) ?? {}) as Record<string, MastraToolSchema>;
        const tools =
          toolOption === false ? undefined : toolOption ? toolOption(modelTools) : modelTools;
        const body = buildChatBody({
          threadId,
          messages: request.messages,
          stored: getStoredIds(state.endpoint, threadId),
          trigger: request.trigger,
          ...(request.messageId && { messageId: request.messageId }),
          ...(pickRecord(extra['resumeData']) && {
            resumeData: pickRecord(extra['resumeData']),
          }),
          ...(typeof extra['runId'] === 'string' && { runId: extra['runId'] }),
          ...(tools && { tools }),
        });
        const key = extra[REQUEST_KEY];
        if (typeof key === 'number') state.pending.set(key, { threadId, body });
        return { body };
      },
    });
    this.mastra = state;
  }

  /** Constructs an unwired copy with the same options (one per thread). */
  override __internal_clone(): AssistantChatTransport<UIMessage> {
    return new MastraChatTransport(this.mastra.options);
  }

  /**
   * Sends one turn. After the stream completes, the thread's stored ids are updated to what the
   * server now holds; an errored or aborted run leaves them unchanged (the next send then
   * re-sends the unconfirmed messages, which the server de-duplicates by id).
   */
  override async sendMessages(
    options: Parameters<ChatTransport<UIMessage>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    const state = this.mastra;
    const key = state.nextRequest++;
    try {
      const stream = await super.sendMessages({
        ...options,
        body: { ...(pickRecord(options.body) ?? {}), [REQUEST_KEY]: key },
      });
      const pending = state.pending.get(key);
      if (!pending) return stream;
      let assistantId: string | undefined;
      let failed = false;
      return stream.pipeThrough(
        new TransformStream<UIMessageChunk, UIMessageChunk>({
          transform(chunk, controller) {
            if (chunk.type === 'start' && chunk.messageId) assistantId = chunk.messageId;
            if (chunk.type === 'error' || chunk.type === 'abort') failed = true;
            controller.enqueue(chunk);
          },
          flush() {
            if (failed) return;
            const ids = storedIdsAfterRun(pending.body, assistantId);
            // A send without `messageIds` did not reconcile: the stored state stays unknown.
            if (ids) setStoredIds(state.endpoint, pending.threadId, ids);
            else clearStoredIds(state.endpoint, pending.threadId);
          },
        }),
      );
    } finally {
      state.pending.delete(key);
    }
  }
}

/**
 * Creates the AI SDK transport for a Mastra agent's chat route (`POST <api>/chat/<agentId>`).
 *
 * Each request carries the auth headers and a whitelisted body:
 * `{ messages, messageIds, memory: { thread }, trigger, messageId, tools }`, where `messages` are
 * only the active-branch messages the server does not store yet (the last assistant message for
 * an approval or tool-result resubmit) and `messageIds` is the whole active branch, which the
 * server uses to drop stored messages of other branches. The transport tracks the stored ids per
 * thread, seeded by the history load and updated after each completed run.
 *
 * While a thread's stored state is unknown (its history load failed or the thread was never
 * loaded), `messageIds` is omitted and `messages` is the whole active branch, so the server does
 * not reconcile (delete) anything; the stored state stays unknown until the history reloads.
 *
 * A failed request rejects with the AI SDK's error, not a `MastraHttpError` (see that class).
 *
 * Pass it to `MastraThreads` as a factory (`transport: () => createMastraTransport(...)`); a
 * plain instance is cloned per thread.
 */
export function createMastraTransport(options: MastraTransportOptions): MastraChatTransport {
  return new MastraChatTransport(options);
}
