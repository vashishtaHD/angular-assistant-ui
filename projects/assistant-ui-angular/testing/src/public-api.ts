/*
 * Public API Surface of angular-assistant-ui/testing.
 * Test helpers for apps built on angular-assistant-ui. This entry point needs
 * the optional `ai` peer dependency. `createScriptedThreadListAdapter` also uses
 * `assistant-stream`, which `@assistant-ui/core` depends on.
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

// Task 20: scripted scenario helpers (approval, ask-user, attachments, thread list).
export {
  askUserAnswerOf,
  currentTurnMessages,
  findToolPart,
  scriptedApprovalTurn,
  scriptedAskUserTurn,
  scriptedTextTurn,
  scriptedToolOutputTurn,
  toolApprovalOf,
  type ScriptedApprovalCall,
  type ScriptedAskUser,
  type ScriptedToolOutput,
  type ScriptedToolPart,
  type ScriptedTurnOptions,
} from './scripted-scenarios';
export {
  createScriptedAttachmentAdapter,
  scriptedFile,
  type ScriptedAttachmentAdapter,
  type ScriptedAttachmentAdapterOptions,
} from './scripted-attachments';
export {
  createScriptedThreadListAdapter,
  type ScriptedThread,
  type ScriptedThreadListAdapter,
  type ScriptedThreadListMethod,
  type ScriptedThreadListOptions,
} from './scripted-thread-list';
// Task 20 end.
