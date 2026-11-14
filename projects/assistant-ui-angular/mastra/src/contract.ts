/**
 * The Mastra server HTTP contract (mastra-server, Task 13) in one place: route paths, query
 * parameters, request bodies and the client's view of which message ids the server stores.
 * The transport, the thread-list adapter and the history adapter build their requests from here,
 * so a contract change is an edit to this file (plus the mock server in `testing/`).
 *
 * The server denies every other route with 403 (fix round 1 of Task 13): never call
 * `/api/agents/*` or the stock memory message routes; history comes only from {@link historyUrl}.
 * Every memory-thread request carries the `agentId` query.
 */
import type { UIMessage } from 'ai';
import type { MastraAuth } from './auth.token';

/** Where a Mastra agent is served. */
export interface MastraEndpoint {
  /** Server origin (and optional path prefix), e.g. `http://localhost:4111`. */
  baseUrl: string;
  /** Agent id, e.g. `chatAgent`. */
  agentId: string;
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');
const seg = encodeURIComponent;

/** `POST` one chat turn. */
export const chatUrl = (e: MastraEndpoint) => `${trimSlash(e.baseUrl)}/chat/${seg(e.agentId)}`;

/** `GET` a thread's messages as AI SDK v7 UI messages (Ruling 1 of Task 13). */
export const historyUrl = (e: MastraEndpoint, threadId: string) =>
  `${chatUrl(e)}/threads/${seg(threadId)}/messages`;

/** `GET` (list) or `POST` (create) memory threads. */
export const threadsUrl = (e: MastraEndpoint, query: Record<string, string> = {}) => {
  const params = new URLSearchParams({ agentId: e.agentId, ...query });
  return `${trimSlash(e.baseUrl)}/api/memory/threads?${params}`;
};

/** `GET`, `PATCH` or `DELETE` one memory thread. */
export const threadUrl = (e: MastraEndpoint, threadId: string) =>
  `${trimSlash(e.baseUrl)}/api/memory/threads/${seg(threadId)}?${new URLSearchParams({ agentId: e.agentId })}`;

/** Query of the thread list: newest activity first. `page` is zero-based. */
export const listQuery = (page: number, perPage: number): Record<string, string> => ({
  page: String(page),
  perPage: String(perPage),
  'orderBy[field]': 'updatedAt',
  'orderBy[direction]': 'DESC',
});

/** A memory thread as the server returns it. */
export interface MastraThread {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/** `GET /api/memory/threads` response. */
export interface MastraThreadPage {
  threads: MastraThread[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/** `GET /chat/:agentId/threads/:threadId/messages` response. */
export interface MastraHistoryResponse {
  messages: UIMessage[];
  total: number;
}

/** A frontend tool schema as the chat route accepts it. */
export interface MastraToolSchema {
  description?: string;
  parameters: Record<string, unknown>;
  [key: string]: unknown;
}

/** The chat route's request body. Any other field is dropped by the server. */
export interface MastraChatBody {
  /** Only `user` and `assistant` messages (Ruling 5). */
  messages: UIMessage[];
  /** The whole active branch, oldest first, ending with the last message. */
  messageIds: string[];
  memory: { thread: string };
  trigger?: 'submit-message' | 'regenerate-message';
  messageId?: string;
  resumeData?: Record<string, unknown>;
  runId?: string;
  tools?: Record<string, MastraToolSchema>;
}

/**
 * Body of `POST /api/memory/threads`. The route requires a non-empty `resourceId` string but
 * derives the user itself and ignores it, so a placeholder is sent.
 */
export const createThreadBody = (threadId: string, metadata: Record<string, unknown>) => ({
  threadId,
  resourceId: 'server-derived',
  metadata,
});

/** Metadata key that models archiving (Mastra has no archive concept). */
export const ARCHIVED_KEY = 'archived';

/** An HTTP error from the Mastra server. */
export class MastraHttpError extends Error {
  /**
   * @param status HTTP status code.
   * @param body The parsed JSON error body (`{ error: string }`), or the raw text.
   */
  constructor(
    readonly status: number,
    readonly body: unknown,
    url: string,
  ) {
    const detail =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : String(body);
    super(`Mastra request failed (${status}) for ${url}: ${detail}`);
    this.name = 'MastraHttpError';
  }
}

/** Resolves the auth headers for one request. */
export async function authHeaders(auth: MastraAuth | undefined): Promise<Record<string, string>> {
  return { ...((await auth?.getHeaders()) ?? {}) };
}

/** Sends a JSON request with the auth headers and returns the parsed body; throws on non-2xx. */
export async function requestJson<T>(
  auth: MastraAuth | undefined,
  fetchFn: typeof fetch | undefined,
  url: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers = await authHeaders(auth);
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await (fetchFn ?? globalThis.fetch)(url, {
    method: init.method ?? 'GET',
    headers,
    ...(auth?.credentials && { credentials: auth.credentials }),
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    ...(init.signal && { signal: init.signal }),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    // Keep the raw text.
  }
  if (!response.ok) throw new MastraHttpError(response.status, parsed, url);
  return parsed as T;
}

// --- Stored message ids -------------------------------------------------------------------------
//
// The server keeps a linear log per thread. On each send it keeps the longest stored prefix that
// matches `messageIds` and deletes the rest (consecutive assistant messages count as one unit,
// keyed by the first id; Ruling 3). The client mirrors the ids the server holds so it can send
// only the messages the server lacks. The history load seeds the record and each completed run
// updates it.

const storedIds = new Map<string, readonly string[]>();
const storedKey = (e: MastraEndpoint, threadId: string) =>
  `${trimSlash(e.baseUrl)}\u0000${e.agentId}\u0000${threadId}`;

/** The ids the server is known to store for a thread, oldest first. */
export const getStoredIds = (e: MastraEndpoint, threadId: string): readonly string[] =>
  storedIds.get(storedKey(e, threadId)) ?? [];

/** Records the ids the server stores for a thread. */
export const setStoredIds = (e: MastraEndpoint, threadId: string, ids: readonly string[]) => {
  storedIds.set(storedKey(e, threadId), [...ids]);
};

/** Forgets a thread's stored ids (after it is deleted). */
export const clearStoredIds = (e: MastraEndpoint, threadId: string) => {
  storedIds.delete(storedKey(e, threadId));
};

/** Message roles the chat route accepts. */
export const isSendableMessage = (message: UIMessage) =>
  message.role === 'user' || message.role === 'assistant';

/**
 * Builds the chat body for a send.
 *
 * - A resubmit (the last message is an assistant message: an approval answer or a tool result)
 *   sends only that message. The server does not reconcile on resubmits (Ruling 4).
 * - Otherwise it sends the active-branch messages after the longest prefix the server stores,
 *   and always at least the last message (a regenerate ends at the stored user message).
 */
export function buildChatBody(args: {
  threadId: string;
  messages: readonly UIMessage[];
  stored: readonly string[];
  trigger?: MastraChatBody['trigger'];
  messageId?: string;
  resumeData?: Record<string, unknown>;
  runId?: string;
  tools?: Record<string, MastraToolSchema>;
}): MastraChatBody {
  const active = args.messages.filter(isSendableMessage);
  const messageIds = active.map((message) => message.id);
  const last = active.at(-1);
  let messages: UIMessage[];
  if (!last) {
    messages = [];
  } else if (last.role === 'assistant') {
    messages = [last];
  } else {
    let keep = 0;
    while (keep < args.stored.length && args.stored[keep] === messageIds[keep]) keep++;
    messages = active.slice(Math.min(keep, active.length - 1));
  }
  return {
    messages,
    messageIds,
    memory: { thread: args.threadId },
    ...(args.trigger && { trigger: args.trigger }),
    ...(args.messageId && { messageId: args.messageId }),
    ...(args.resumeData && { resumeData: args.resumeData }),
    ...(args.runId && { runId: args.runId }),
    ...(args.tools && Object.keys(args.tools).length > 0 && { tools: args.tools }),
  };
}

/**
 * The ids the server stores after a completed run of `body`: the active branch, plus the
 * streamed assistant message for a normal send. A resubmit extends the stored assistant unit in
 * place, so its ids do not change.
 */
export function storedIdsAfterRun(body: MastraChatBody, assistantId: string | undefined): string[] {
  const last = body.messages.at(-1);
  const isResubmit = last?.role === 'assistant' || body.resumeData !== undefined;
  if (isResubmit || !assistantId || body.messageIds.at(-1) === assistantId) return body.messageIds;
  return [...body.messageIds, assistantId];
}
