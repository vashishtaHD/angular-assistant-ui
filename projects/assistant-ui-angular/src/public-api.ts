/*
 * Public API Surface of angular-assistant-ui.
 * Every export must be re-exported from this file and carry TSDoc.
 */

export { AUI_CONTEXT, type AuiContext } from './lib/context/aui-context';
export { AuiProviderDirective } from './lib/provider/aui-provider.directive';
export { AuiIfDirective } from './lib/aui-if.directive';
export { injectAui } from './lib/state/inject-aui';
export { injectAuiState } from './lib/state/inject-aui-state';
export { injectAuiEvent } from './lib/state/inject-aui-event';

// Task 3: scoped message list and thread/message roots.
export {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './lib/primitives/thread-messages.component';
export { AuiMessageRootDirective } from './lib/primitives/message-root.directive';
export { AuiThreadRootDirective } from './lib/primitives/thread-root.directive';

// Store primitives, re-exported as upstream's Vue binding does.
export {
  AuiConfig,
  Derived,
  createAssistantClient,
  type AssistantClient,
  type AssistantClientHandle,
  type AssistantClientSource,
  type AssistantConfigSource,
  type AssistantState,
  type AssistantEventCallback,
  type AssistantEventName,
  type AssistantEventSelector,
  type Unsubscribe,
} from '@assistant-ui/store/client';

// Thread viewport.
export { AuiThreadViewportDirective } from './lib/primitives/thread-viewport.directive';
export {
  AUI_VIEWPORT,
  injectAuiViewport,
  type AuiViewport,
} from './lib/primitives/viewport-context';

// Composer primitives.
export { AuiComposerRootDirective } from './lib/primitives/composer-root.directive';
export { AuiComposerInputDirective } from './lib/primitives/composer-input.directive';
export { AuiComposerSendDirective } from './lib/primitives/composer-send.directive';
export { AuiComposerCancelDirective } from './lib/primitives/composer-cancel.directive';

// Message parts and tool UI registry.
export {
  AuiMessagePartsComponent,
  AuiPartTemplateDirective,
  type AuiPartTemplateContext,
} from './lib/primitives/message-parts.component';
export {
  registerToolUI,
  type DataUIProps,
  type ToolUIComponent,
  type ToolUIProps,
} from './lib/tools/tool-ui';

// Task 1: shared action-button infrastructure (host directive for button primitives).
export {
  AuiActionButtonHostDirective,
  injectActionButton,
  type ActionButtonOptions,
} from './lib/primitives/action-button';

// Task 22: model context, frontend tools, interactables and runtime helpers.
export {
  injectAssistantInstructions,
  type AssistantInstructionsOptions,
  type MaybeSignal,
} from './lib/model-context/instructions';
export {
  injectAssistantContext,
  type AssistantContextConfig,
  type AssistantContextOptions,
} from './lib/model-context/context';
export { AuiAssistantVisibleDirective } from './lib/model-context/visible';
export {
  makeAssistantTool,
  registerTool,
  type AssistantTool,
  type AssistantToolProps,
  type AuiToolDefinition,
  type AuiToolDisplay,
} from './lib/tools/register-tool';
export {
  injectAuiToolOverrides,
  registerToolkit,
  type AuiToolOverrides,
  type AuiToolkit,
} from './lib/tools/toolkit';
export {
  unstable_injectInteractable,
  unstable_injectInteractableState,
  unstable_injectInteractableVersions,
  type InteractableConfig,
  type InteractableHandle,
  type InteractableStateHandle,
  type InteractableStateUpdater,
} from './lib/interactables/inject-interactable';
export {
  injectAssistantInteractable,
  injectInteractableState,
  type AssistantInteractableProps,
  type LegacyInteractableStateHandle,
} from './lib/interactables/legacy';
export {
  registerInteractableToolConfig,
  unstable_interactableTool,
  type InteractableToolRenderComponent,
  type Unstable_InteractableToolConfig,
  type Unstable_InteractableToolRenderProps,
} from './lib/interactables/interactable-tool';
export { unstable_injectThreadMessageIds } from './lib/state/inject-thread-message-ids';
export {
  createExternalStoreRuntime,
  createLocalRuntime,
  injectExternalStoreRuntime,
  injectLocalRuntime,
  remoteThreadListConfig,
  type LocalRuntimeFactoryOptions,
  type ManagedRuntime,
  type RemoteThreadListConfigOptions,
} from './lib/runtime/factories';
export {
  createExternalMessageConverter,
  type ExternalMessageConverter,
  type ExternalMessageConverterCallback,
  type ExternalMessageConverterMetadata,
} from './lib/runtime/external-message-converter';
export {
  messageObjectScope,
  readonlyThreadScope,
  textMessagePartScope,
  threadListItemRuntimeScope,
  type ReadonlyThreadScope,
} from './lib/runtime/scopes';
export * from './lib/runtime/re-exports';
export {
  createAssistantTransportRuntime,
  injectAssistantTransportSendCommand,
  injectAssistantTransportState,
  type AssistantTransportRuntime,
  type AssistantTransportRuntimeOptions,
} from './lib/runtime/assistant-transport';
