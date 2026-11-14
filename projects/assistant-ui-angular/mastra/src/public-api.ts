/*
 * Public API Surface of angular-assistant-ui/mastra.
 * A Mastra memory thread list, history, transport and auth for angular-assistant-ui. This entry
 * point needs the optional `ai`, `@ai-sdk/react`, `@assistant-ui/ai-sdk` and `assistant-stream`
 * peer dependencies.
 */

export { MASTRA_AUTH, type MastraAuth } from './auth.token';
export {
  MastraHttpError,
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
