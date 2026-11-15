// Original (no upstream counterpart): the Mastra server HTTP contract.
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
  /**
   * The whole active branch, oldest first, ending with the last message. Omitted while the
   * stored state is unknown: the server then reconciles (deletes) nothing.
   */
  messageIds?: string[];
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

/**
 * An HTTP error from the Mastra memory and history routes (`mastraThreadListAdapter`,
 * `mastraHistoryAdapter`).
 *
 * Chat requests (`createMastraTransport`) go through the AI SDK, so a failed chat request is the
 * AI SDK's error instead (its `message` is the server's raw JSON body, e.g.
 * `{"error":"Message id already in use"}` for a 409), shown as the thread's error. A history load
 * failure is logged by assistant-ui core (`console.error`) and the thread shows as empty. An app
 * that reacts to 401/403 should handle both a `MastraHttpError` (check `status`) and the chat
 * error from the thread.
 */
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
// only the messages the server lacks. The history load seeds the record, creating a thread
// records it as empty, and each completed run updates it.
//
// No record means the stored state is UNKNOWN (the history load failed or has not finished, or
// the thread was deleted). That is never treated as "empty": an empty `messageIds` prefix would
// make the server delete the whole stored thread. Instead the send omits `messageIds`, which the
// server takes as "do not reconcile", and carries the whole active branch (the server
// de-duplicates messages it already stores by id). Such a send leaves the record as it is, so a
// history load that finishes during it still counts. After a failed load the state stays unknown
// until the page reloads (see `createMastraTransport`).
//
// The record is per page: another tab or device changing the same thread makes it stale (see
// `createMastraTransport`, "Two tabs").

const storedIds = new Map<string, readonly string[]>();
const storedKey = (e: MastraEndpoint, threadId: string) =>
  `${trimSlash(e.baseUrl)}\u0000${e.agentId}\u0000${threadId}`;

/**
 * The ids the server is known to store for a thread, oldest first, or `undefined` when the
 * stored state is unknown.
 */
export const getStoredIds = (e: MastraEndpoint, threadId: string): readonly string[] | undefined =>
  storedIds.get(storedKey(e, threadId));

/** Records the ids the server stores for a thread. */
export const setStoredIds = (e: MastraEndpoint, threadId: string, ids: readonly string[]) => {
  storedIds.set(storedKey(e, threadId), [...ids]);
};

/** Marks a thread's stored state unknown (after it is deleted). */
export const clearStoredIds = (e: MastraEndpoint, threadId: string) => {
  storedIds.delete(storedKey(e, threadId));
};

/**
 * Forgets every thread's stored ids, for example on sign-out, or when another tab may have changed
 * a thread (a stale record would make the next send drop that tab's newer messages). Later sends
 * of a thread whose history is not reloaded carry the whole branch without reconciling, which
 * deletes nothing (but edits and regenerates then do not reconcile either).
 *
 * The record is keyed by the server URL as written (`api` for the transport, `baseUrl` for the
 * adapters; a trailing slash is ignored), the agent id and the thread id. Pass the same URL to
 * both, or the transport never finds the ids the history load recorded and every send carries
 * the whole branch.
 */
export const clearMastraStoredIds = () => {
  storedIds.clear();
};

/** Message roles the chat route accepts. */
export const isSendableMessage = (message: UIMessage) =>
  message.role === 'user' || message.role === 'assistant';

/**
 * Builds the chat body for a send.
 *
 * - A resubmit (the last message is an assistant message: an approval answer or a tool result)
 *   sends only that message. The server does not reconcile on resubmits (Ruling 4), so a
 *   resubmit on a branch the server no longer stores (an approval answered on an old branch after
 *   an edit was sent) is appended to the stored branch; that is a contract limitation.
 * - Otherwise, when the stored ids are known, it sends the active-branch messages after the
 *   longest stored prefix (always at least the last message: a regenerate ends at the stored user
 *   message) and `messageIds`, the whole active branch, so the server drops other branches.
 * - When the stored ids are unknown (`stored` is `undefined`), it sends the whole active branch
 *   and no `messageIds`, so the server reconciles nothing and deletes nothing.
 */
export function buildChatBody(args: {
  threadId: string;
  messages: readonly UIMessage[];
  stored: readonly string[] | undefined;
  trigger?: MastraChatBody['trigger'];
  messageId?: string;
  resumeData?: Record<string, unknown>;
  runId?: string;
  tools?: Record<string, MastraToolSchema>;
}): MastraChatBody {
  const { stored } = args;
  const active = args.messages.filter(isSendableMessage);
  const messageIds = active.map((message) => message.id);
  const last = active.at(-1);
  let messages: UIMessage[];
  if (!last) {
    messages = [];
  } else if (last.role === 'assistant') {
    messages = [last];
  } else if (stored === undefined) {
    messages = [...active];
  } else {
    let keep = 0;
    while (keep < stored.length && stored[keep] === messageIds[keep]) keep++;
    messages = active.slice(Math.min(keep, active.length - 1));
  }
  return {
    messages,
    ...(stored !== undefined && { messageIds }),
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
 * place, so its ids do not change. A send without `messageIds` did not reconcile, so the run
 * tells nothing about the stored ids (`undefined`): the record is left as it is.
 */
export function storedIdsAfterRun(
  body: MastraChatBody,
  assistantId: string | undefined,
): string[] | undefined {
  const { messageIds } = body;
  if (!messageIds) return undefined;
  const last = body.messages.at(-1);
  const isResubmit = last?.role === 'assistant' || body.resumeData !== undefined;
  if (isResubmit || !assistantId || messageIds.at(-1) === assistantId) return messageIds;
  return [...messageIds, assistantId];
}
