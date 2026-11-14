import { Injector, inject, runInInjectionContext } from '@angular/core';
import type { RemoteThreadListAdapter } from '@assistant-ui/core';
import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatInit,
  type ChatTransport,
  type UIMessage,
} from 'ai';
import { isMissingInjectionContext } from './auth.token';
import { RemoteAISDKThreads, type RemoteAISDKThreadsOptions } from './vendor/AISDKThreads';

/** Options for {@link MastraThreads}. */
export type MastraThreadsOptions = Omit<
  RemoteAISDKThreadsOptions<UIMessage>,
  'transport' | 'adapter'
> & {
  /**
   * Creates each thread's transport, usually `() => createMastraTransport({ api, agentId })`.
   * When `MastraThreads` is called in an injection context, the factory runs in that context
   * (so `createMastraTransport` finds `MASTRA_AUTH`). A plain `AssistantChatTransport` instance
   * is also accepted and cloned per thread.
   */
  transport: (() => ChatTransport<UIMessage>) | ChatTransport<UIMessage>;
  /** The thread list, usually `mastraThreadListAdapter({ baseUrl, agentId })`. */
  adapter: RemoteThreadListAdapter;
};

/**
 * Resubmits automatically once every tool approval of the last assistant step is answered, or
 * once every client tool call of the last step has a result (for example an ask-the-user tool
 * answered through `addResult`).
 */
export const mastraSendAutomaticallyWhen: NonNullable<
  ChatInit<UIMessage>['sendAutomaticallyWhen']
> = (options) =>
  lastAssistantMessageIsCompleteWithApprovalResponses(options) ||
  lastAssistantMessageIsCompleteWithToolCalls(options);

/**
 * `AuiConfig` entry for a Mastra agent with memory: a `RemoteThreadList` over `adapter` with
 * background threads, one AI SDK chat per thread (keyed by thread id, so each thread loads its
 * history once), and {@link mastraSendAutomaticallyWhen} unless `sendAutomaticallyWhen` is given.
 * Call it in an injection context (a component field initializer) so the transport factory can
 * read `MASTRA_AUTH`.
 *
 * @example
 * ```ts
 * readonly config = AuiConfig({
 *   threads: MastraThreads({
 *     adapter: mastraThreadListAdapter({ baseUrl: 'http://localhost:4111', agentId: 'chatAgent' }),
 *     transport: () => createMastraTransport({ api: 'http://localhost:4111', agentId: 'chatAgent' }),
 *   }),
 * });
 * ```
 */
export function MastraThreads(options: MastraThreadsOptions) {
  const { transport } = options;
  const injector = currentInjector();
  return RemoteAISDKThreads<UIMessage>({
    ...options,
    sendAutomaticallyWhen: options.sendAutomaticallyWhen ?? mastraSendAutomaticallyWhen,
    transport:
      typeof transport === 'function' && injector
        ? () => runInInjectionContext(injector, transport)
        : transport,
  });
}

const currentInjector = (): Injector | undefined => {
  try {
    return inject(Injector);
  } catch (error) {
    if (isMissingInjectionContext(error)) return undefined;
    throw error;
  }
};
