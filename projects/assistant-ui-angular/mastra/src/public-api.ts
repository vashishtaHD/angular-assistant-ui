/*
 * Public API Surface of angular-assistant-ui/mastra.
 * A Mastra memory thread list, history, transport and auth for angular-assistant-ui. This entry
 * point needs the optional `ai`, `@ai-sdk/react`, `@assistant-ui/ai-sdk`, `assistant-stream` and
 * `react` peer dependencies.
 *
 * `./vendor/` is vendored from `@assistant-ui/ai-sdk@0.0.18`, which is why that peer is pinned
 * exactly. Raising the pin requires re-vendoring those files against the new version.
 */

export { MASTRA_AUTH, type MastraAuth } from './auth.token';
export {
  MastraHttpError,
  clearMastraStoredIds,
  type MastraChatBody,
  type MastraHistoryResponse,
  type MastraThread,
  type MastraThreadPage,
  type MastraToolSchema,
} from './contract';
export { mastraHistoryAdapter, type MastraHistoryAdapterOptions } from './history-adapter';
export {
  MastraThreads,
  mastraSendAutomaticallyWhen,
  type MastraThreadsOptions,
} from './mastra-threads';
export {
  mastraThreadListAdapter,
  type MastraThreadListAdapterOptions,
} from './thread-list-adapter';
export {
  MastraChatTransport,
  createMastraTransport,
  type MastraTransportOptions,
} from './transport';
