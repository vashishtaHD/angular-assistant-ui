/*
 * Public API Surface of angular-assistant-ui/testing.
 * Test helpers for apps built on angular-assistant-ui. This entry point needs
 * the optional `ai` peer dependency.
 */

export { createScriptedChatTransport, type ScriptedTurn } from './scripted-chat-transport';

// Task 14: an in-memory fake of the Mastra server contract.
export {
  createMockMastraServer,
  type MockMastraChatTurn,
  type MockMastraReply,
  type MockMastraRequest,
  type MockMastraServer,
  type MockMastraServerOptions,
  type MockMastraThread,
} from './mock-mastra-server';
