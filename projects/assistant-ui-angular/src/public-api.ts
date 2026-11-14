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

// Task 5: full composer (root form, full input props, quote, queue).
export {
  AuiComposerInputDirective,
  type AuiComposerSubmitMode,
} from './lib/primitives/composer-input.directive';
export {
  AuiComposerQuoteDirective,
  AuiComposerQuoteTextDirective,
  AuiComposerQuoteDismissDirective,
} from './lib/primitives/composer-quote.directive';
export {
  AuiComposerQueueComponent,
  AuiQueueItemTemplateDirective,
} from './lib/primitives/composer-queue.component';
export { AuiQueueItemTextDirective } from './lib/primitives/queue-item/text';
export { AuiQueueItemSteerDirective } from './lib/primitives/queue-item/steer';
export { AuiQueueItemRemoveDirective } from './lib/primitives/queue-item/remove';
export {
  AUI_COMPOSER_COMPACT,
  AUI_COMPOSER_INPUT_PLUGIN_REGISTRY,
  AUI_THREAD_ROOT_ELEMENT,
  injectComposerCancelWithFocus,
  injectComposerRunStartFocusGuard,
  type AuiComposerCompact,
  type AuiComposerInputPlugin,
  type AuiComposerInputPluginRegistry,
  type ComposerRunStartFocusGuard,
} from './lib/primitives/composer-input-support';
export {
  injectComposerInput,
  type ComposerInputBridge,
  type ComposerInputOptions,
} from './lib/primitives/composer-input-bridge';
export {
  injectComposerInputHistory,
  type ComposerInputHistory,
} from './lib/primitives/composer-input-history';
