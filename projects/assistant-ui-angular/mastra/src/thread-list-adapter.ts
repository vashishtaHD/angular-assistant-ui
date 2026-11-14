import type {
  AttachmentAdapter,
  RemoteThreadListAdapter,
  RemoteThreadMetadata,
  RuntimeAdapters,
} from '@assistant-ui/core';
import { useAui } from '@assistant-ui/store';
import { createAssistantStream } from 'assistant-stream';
import { useMemo } from 'react';
import { resolveMastraAuth, type MastraAuth } from './auth.token';
import {
  ARCHIVED_KEY,
  MastraHttpError,
  clearStoredIds,
  createThreadBody,
  listQuery,
  requestJson,
  setStoredIds,
  threadsUrl,
  threadUrl,
  type MastraEndpoint,
  type MastraThread,
  type MastraThreadPage,
} from './contract';
import { mastraHistoryAdapter } from './history-adapter';

/** Options for {@link mastraThreadListAdapter}. */
export interface MastraThreadListAdapterOptions {
  /** Mastra server origin (and optional path prefix), e.g. `http://localhost:4111`. */
  baseUrl: string;
  /** Agent whose memory threads are listed, e.g. `chatAgent`. */
  agentId: string;
  /** Auth headers. Defaults to the provided `MASTRA_AUTH` when created in an injection context. */
  auth?: MastraAuth;
  /** Threads per page. Default 20. */
  pageSize?: number;
  /**
   * Attachment adapter for every thread (for example one that uploads to the host's storage and
   * sends https URLs). Default: the AI SDK runtime's data-URL adapter.
   */
  attachments?: AttachmentAdapter;
  /** Title polling for `generateTitle`. Default every 1000 ms for up to 15000 ms. */
  titlePolling?: { intervalMs?: number; timeoutMs?: number };
  /** Custom `fetch` (defaults to `globalThis.fetch` at call time). */
  fetch?: typeof fetch;
}

const toMetadata = (thread: MastraThread): RemoteThreadMetadata => {
  const { [ARCHIVED_KEY]: archived, ...custom } = thread.metadata ?? {};
  return {
    status: archived === true ? 'archived' : 'regular',
    remoteId: thread.id,
    ...(thread.title && { title: thread.title }),
    lastMessageAt: new Date(thread.updatedAt),
    ...(Object.keys(custom).length > 0 && { custom }),
  };
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A `RemoteThreadListAdapter` over Mastra memory threads, for `MastraThreads`.
 *
 * - `list` pages through the user's threads, newest activity first (`nextCursor` is the next
 *   page); `metadata.archived === true` marks an archived thread, the other metadata keys are
 *   the thread's `custom` data.
 * - `initialize` creates the thread with `metadata.archived = false`; the remote id is the
 *   thread id.
 * - `rename`, `archive`, `unarchive` and `updateCustom` PATCH the thread. The server replaces
 *   `metadata` as a whole, so the adapter merges with the thread's current metadata first.
 * - `delete` and `fetch` call the matching routes.
 * - `generateTitle` waits for the title Mastra generates asynchronously after the first turn
 *   (polling the thread) and streams it. Polling ends at the title, at `titlePolling.timeoutMs`,
 *   or once the thread is deleted (through this adapter, or a 404), without an error. Core's
 *   `generateTitle` passes no abort signal, so destroying the app does not stop a poll early;
 *   it stops at the timeout.
 * - `unstable_useAdapters` gives every thread a read-only history adapter (and `attachments`).
 *
 * The server derives the user from the auth headers; no resource id is sent.
 */
export function mastraThreadListAdapter(
  options: MastraThreadListAdapterOptions,
): RemoteThreadListAdapter {
  const endpoint: MastraEndpoint = { baseUrl: options.baseUrl, agentId: options.agentId };
  const auth = resolveMastraAuth(options.auth);
  const pageSize = options.pageSize ?? 20;
  const intervalMs = options.titlePolling?.intervalMs ?? 1000;
  const timeoutMs = options.titlePolling?.timeoutMs ?? 15000;
  const request = <T>(url: string, init?: { method?: string; body?: unknown }) =>
    requestJson<T>(auth, options.fetch, url, init);

  const getThread = (remoteId: string) => request<MastraThread>(threadUrl(endpoint, remoteId));
  /** Threads deleted through this adapter: their title polling stops. */
  const deleted = new Set<string>();
  const patchMetadata = async (
    remoteId: string,
    update: (metadata: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    const thread = await getThread(remoteId);
    await request(threadUrl(endpoint, remoteId), {
      method: 'PATCH',
      body: { metadata: update({ ...(thread.metadata ?? {}) }) },
    });
  };

  return {
    async list({ after } = {}) {
      const page = after === undefined ? 0 : Number(after);
      const result = await request<MastraThreadPage>(
        threadsUrl(endpoint, listQuery(page, pageSize)),
      );
      return {
        threads: result.threads.map(toMetadata),
        ...(result.hasMore && { nextCursor: String(page + 1) }),
      };
    },
    async initialize(threadId, init) {
      await request(threadsUrl(endpoint), {
        method: 'POST',
        body: createThreadBody(threadId, { ...(init?.custom ?? {}), [ARCHIVED_KEY]: false }),
      });
      // The server just created the thread, so its stored state is known: empty.
      setStoredIds(endpoint, threadId, []);
      return { remoteId: threadId, externalId: undefined };
    },
    async rename(remoteId, title) {
      await request(threadUrl(endpoint, remoteId), { method: 'PATCH', body: { title } });
    },
    archive: (remoteId) =>
      patchMetadata(remoteId, (metadata) => ({ ...metadata, [ARCHIVED_KEY]: true })),
    unarchive: (remoteId) =>
      patchMetadata(remoteId, (metadata) => ({ ...metadata, [ARCHIVED_KEY]: false })),
    updateCustom: (remoteId, custom) =>
      patchMetadata(remoteId, (metadata) => ({
        ...(custom ?? {}),
        [ARCHIVED_KEY]: metadata[ARCHIVED_KEY] === true,
      })),
    async delete(remoteId) {
      await request(threadUrl(endpoint, remoteId), { method: 'DELETE' });
      clearStoredIds(endpoint, remoteId);
      deleted.add(remoteId);
    },
    async fetch(threadId) {
      return toMetadata(await getThread(threadId));
    },
    async generateTitle(remoteId) {
      return createAssistantStream(async (controller) => {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          // Stop once the thread is deleted (through this adapter, or gone on the server).
          if (deleted.has(remoteId)) return;
          let title: string | undefined;
          try {
            ({ title } = await getThread(remoteId));
          } catch (error) {
            if (error instanceof MastraHttpError && error.status === 404) return;
            throw error;
          }
          if (title) {
            controller.appendText(title);
            return;
          }
          if (Date.now() + intervalMs > deadline) return;
          await delay(intervalMs);
        }
      });
    },
    unstable_useAdapters: function useMastraAdapters(): RuntimeAdapters {
      const aui = useAui();
      return useMemo<RuntimeAdapters>(
        () => ({
          history: mastraHistoryAdapter({
            ...endpoint,
            ...(auth && { auth }),
            ...(options.fetch && { fetch: options.fetch }),
            getRemoteId: () =>
              aui.threadListItem.source ? aui.threadListItem.getState().remoteId : undefined,
          }),
          ...(options.attachments && { attachments: options.attachments }),
        }),
        [aui],
      );
    },
  };
}
