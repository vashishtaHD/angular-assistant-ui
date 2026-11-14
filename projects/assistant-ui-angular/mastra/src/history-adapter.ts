import type {
  GenericThreadHistoryAdapter,
  MessageFormatItem,
  MessageFormatRepository,
  ThreadHistoryAdapter,
} from '@assistant-ui/core';
import type { UIMessage } from 'ai';
import type { MastraAuth } from './auth.token';
import {
  historyUrl,
  MastraHttpError,
  requestJson,
  setStoredIds,
  type MastraEndpoint,
  type MastraHistoryResponse,
} from './contract';

/** Options for {@link mastraHistoryAdapter}. */
export interface MastraHistoryAdapterOptions extends MastraEndpoint {
  /** Auth headers for the history request. */
  auth?: MastraAuth;
  /** Returns the thread's remote id, or `undefined` while the thread is not created yet. */
  getRemoteId: () => string | undefined;
  /** Custom `fetch` (defaults to `globalThis.fetch` at call time). */
  fetch?: typeof fetch;
}

/**
 * A read-only `ThreadHistoryAdapter` over the Mastra history route
 * (`GET /chat/:agentId/threads/:threadId/messages`).
 *
 * Mastra memory persists the conversation on the server, so the runtime's writes (`append`,
 * `update`, `delete`) are no-ops. `withFormat(...).load()` returns the server's v7 UI messages in
 * ascending order, each one's `parentId` chained to the previous one, and records their ids as the
 * thread's stored ids for the transport. A thread the server does not know yet (404) loads as
 * empty.
 */
export function mastraHistoryAdapter(options: MastraHistoryAdapterOptions): ThreadHistoryAdapter {
  const loadMessages = async (): Promise<UIMessage[]> => {
    const remoteId = options.getRemoteId();
    if (!remoteId) return [];
    try {
      const { messages } = await requestJson<MastraHistoryResponse>(
        options.auth,
        options.fetch,
        historyUrl(options, remoteId),
      );
      setStoredIds(
        options,
        remoteId,
        messages.map((message) => message.id),
      );
      return messages;
    } catch (error) {
      if (error instanceof MastraHttpError && error.status === 404) {
        setStoredIds(options, remoteId, []);
        return [];
      }
      throw error;
    }
  };

  const noop = async () => undefined;

  return {
    load: async () => ({ messages: [] }),
    append: noop,
    update: noop,
    delete: noop,
    // The server returns AI SDK v7 UI messages, the format the AI SDK runtime asks for, so the
    // format adapter is not needed.
    withFormat<TMessage>(): GenericThreadHistoryAdapter<TMessage> {
      return {
        load: async (): Promise<MessageFormatRepository<TMessage>> => {
          const messages = await loadMessages();
          const items: MessageFormatItem<TMessage>[] = messages.map((message, index) => ({
            parentId: index === 0 ? null : messages[index - 1]!.id,
            message: message as TMessage,
          }));
          return { headId: messages.at(-1)?.id ?? null, messages: items };
        },
        append: noop,
        update: noop,
        delete: noop,
      };
    },
  };
}
