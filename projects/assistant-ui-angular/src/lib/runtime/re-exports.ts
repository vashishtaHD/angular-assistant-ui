// Ported from packages/core/src/index.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/index.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (typed re-exports of the framework-neutral contracts, helpers and store clients)

// Model context contracts and helpers.
export {
  ModelContextRegistry,
  mergeModelContexts,
  unstable_formatInteractableSnapshot,
  unstable_getInteractableSnapshots,
  unstable_getInteractableVersions,
  type LanguageModelConfig,
  type LanguageModelV1CallSettings,
  type ModelContext,
  type ModelContextOptions,
  type ModelContextProvider,
  type ModelContextRegistryInstructionHandle,
  type ModelContextRegistryProviderHandle,
  type ModelContextRegistryToolHandle,
  type SerializedModelContext,
  type SerializedTool,
  type SystemPart,
  type Unstable_InteractableSnapshotEntry,
  type Unstable_InteractableVersion,
} from '@assistant-ui/core';
export { ModelContext as ModelContextClient } from '@assistant-ui/core/store';

// Tools and toolkits.
export { tool, type ToolExecutionStatus } from '@assistant-ui/core';
export type { Tool } from 'assistant-stream';
export {
  Tools,
  defineMcpToolkit,
  defineToolkit,
  externalTool,
  hitl,
  hitlTool,
  humanTool,
  providerTool,
  stubTool,
  type McpToolkitDefinition,
  type McpToolkitEntry,
  type McpToolkitToolConfig,
  type ProviderToolConfig,
  type ToolCallText,
  type ToolDefinition,
  type Toolkit,
  type ToolkitDefinition,
  type ToolkitDefinitionEntry,
} from '@assistant-ui/core/react';

// Interactables: scope resources and types.
export {
  Interactables,
  unstable_Interactables,
  type InteractableDefinition,
  type InteractablePersistedState,
  type InteractablePersistenceAdapter,
  type InteractablePersistenceStatus,
  type InteractableRegistration,
  type InteractablesClientSchema,
  type InteractablesMethods,
  type InteractablesState,
  type Unstable_InferInteractableState,
  type Unstable_InteractableDefinition,
  type Unstable_InteractablePersistedState,
  type Unstable_InteractablePersistenceAdapter,
  type Unstable_InteractablePersistenceStatus,
  type Unstable_InteractableRegistration,
  type Unstable_InteractablesClientSchema,
  type Unstable_InteractablesConfig,
  type Unstable_InteractablesMethods,
  type Unstable_InteractablesState,
  type Unstable_InteractableStateSchema,
  type Unstable_InteractableVersionInfo,
} from '@assistant-ui/core/react';

// Store events, state slices and message-queue helpers.
export type { AssistantEventPayload, AssistantEventScope } from '@assistant-ui/store';
export type { EnrichedPartState, PartState } from '@assistant-ui/core/react';
export {
  createMessageQueue,
  type ComposerRuntimeState,
  type ComposerSubmission,
  type ComposerTextOrigin,
  type EditComposerState,
  type ExternalThreadBranchAdapter,
  type ExternalThreadQueueAdapter,
  type MessageQueueController,
  type MessageQueueDriver,
  type ThreadComposerState,
} from '@assistant-ui/core';
export type {
  ComposerSendOptions,
  ComposerState,
  QueueItemMethods,
  QueueItemState,
  TaskMethods,
  TaskState,
} from '@assistant-ui/core/store';

// Core store clients.
export {
  ChainOfThoughtClient,
  ExternalThread,
  InMemoryThreadList,
  RemoteThreadList,
  SingleThreadList,
  type ExternalThreadMessage,
  type ExternalThreadProps,
  type InMemoryThreadListProps,
  type RemoteThreadListProps,
  type ThreadsState,
} from '@assistant-ui/core/store';

// Thread list runtime types and title generation.
export type {
  ThreadListItemRuntime,
  ThreadListItemRuntimeState,
  ThreadListItemStatus,
  ThreadListRuntime,
  ThreadListState,
} from '@assistant-ui/core';
export type { ThreadListItemState } from '@assistant-ui/core/store';
export { createSimpleTitleAdapter, type TitleGenerationAdapter } from '@assistant-ui/core/react';
export type { JoinStrategy } from '@assistant-ui/core/store';

// Runtime option and adapter contracts (the hook-free half of the runtime hooks).
export {
  bindExternalStoreMessage,
  getExternalStoreMessages,
  pickExternalStoreSharedOptions,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
  type ChatModelRunUpdate,
  type ExternalStoreAdapter,
  type ExternalStoreBranchChange,
  type ExternalStoreMessageConverter,
  type ExternalStoreSharedOptions,
  type ExternalStoreThreadData,
  type ExternalStoreThreadListAdapter,
  type LocalRuntimeOptionsBase,
} from '@assistant-ui/core';
export type { LocalRuntimeOptions } from '@assistant-ui/core/react';
export {
  convertExternalMessages as unstable_convertExternalMessages,
  createExternalMessageConversionCache as unstable_createExternalMessageConversionCache,
  createMessageConverter as unstable_createMessageConverter,
  type ExternalMessageConversionCache as Unstable_ExternalMessageConversionCache,
} from '@assistant-ui/core/react';

// Message and runtime helpers and types.
export {
  ExportedMessageRepository,
  MessageNotSentError,
  fromThreadMessageLike,
  generateId,
  isMessageNotSentError,
  toolApprovalAcceptsText,
  type AddToolResultOptions,
  type ExportedMessageRepositoryItem,
  type MessageRole,
  type RunConfig,
  type RuntimeCapabilities,
  type ThreadMessageLike,
} from '@assistant-ui/core';
export type {
  AssistantRuntime,
  ComposerRuntime,
  CreateAppendMessage,
  CreateResumeRunConfig,
  CreateStartRunConfig,
  EditComposerRuntime,
  MessagePartRuntime,
  MessagePartState,
  MessageRuntime,
  MessageRuntimeState,
  MessageState,
  ThreadComposerRuntime,
  ThreadRuntime,
  ThreadRuntimeState,
  ThreadState,
} from '@assistant-ui/core';

// Message part and message types.
export type {
  AppendMessage,
  DataMessagePart,
  FileMessagePart,
  ImageMessagePart,
  MessageModality,
  MessagePartStatus,
  MessagePartStreamStatus,
  MessagePartTiming,
  MessageStatus,
  MessageTiming,
  PartProviderMetadata,
  QuoteInfo,
  ReasoningMessagePart,
  SourceMessagePart,
  SourceProviderMetadata,
  TextMessagePart,
  ThreadAssistantMessage,
  ThreadAssistantMessagePart,
  ThreadMessage,
  ThreadSystemMessage,
  ThreadUserMessage,
  ThreadUserMessagePart,
  ToolCallMessagePart,
  ToolCallMessagePartStatus,
  ToolCallTiming,
  ToolModelContentPart,
  Unstable_AudioMessagePart,
} from '@assistant-ui/core';

// Tool approval types.
export type {
  RespondToToolApprovalOptions,
  ToolApprovalAnswer,
  ToolApprovalDisplay,
  ToolApprovalOption,
  ToolApprovalOptionKind,
  ToolApprovalQuestion,
  ToolApprovalQuestionOption,
  ToolApprovalResponse,
} from '@assistant-ui/core';

// Type augmentation point for typed registrations.
export type { Assistant } from '@assistant-ui/core';

// Core transport types (the hook-free half of the assistant-transport hooks).
export type {
  AssistantTransportCommand,
  AssistantTransportConnectionMetadata,
  AssistantTransportProtocol,
  SendCommandsRequestBody,
} from '@assistant-ui/core/react';
