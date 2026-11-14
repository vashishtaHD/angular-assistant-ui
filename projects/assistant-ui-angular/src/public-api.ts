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

// Task 10: headless menus, composer trigger popover, selection toolbar and assistant modal.
export { AuiMenuRootDirective } from './lib/primitives/menu/menu-root.directive';
export type {
  AuiMenuInitialFocus,
  AuiMenuSetOpenOptions,
} from './lib/primitives/menu/menu-root.directive';
export { AuiMenuTriggerDirective } from './lib/primitives/menu/menu-trigger.directive';
export { AuiMenuContentDirective } from './lib/primitives/menu/menu-content.directive';
export { AuiMenuItemDirective } from './lib/primitives/menu/menu-item.directive';
export { AuiMenuSeparatorDirective } from './lib/primitives/menu/menu-separator.directive';
export {
  AuiActionBarMoreRootDirective,
  AuiActionBarMoreTriggerDirective,
  AuiActionBarMoreContentDirective,
  AuiActionBarMoreItemDirective,
  AuiActionBarMoreSeparatorDirective,
} from './lib/primitives/action-bar-more';
export {
  AuiThreadListItemMoreRootDirective,
  AuiThreadListItemMoreTriggerDirective,
  AuiThreadListItemMoreContentDirective,
  AuiThreadListItemMoreItemDirective,
  AuiThreadListItemMoreSeparatorDirective,
} from './lib/primitives/thread-list-item-more';
export { AuiAssistantModalRootDirective } from './lib/primitives/assistant-modal/assistant-modal-root.directive';
export { AuiAssistantModalTriggerDirective } from './lib/primitives/assistant-modal/assistant-modal-trigger.directive';
export { AuiAssistantModalAnchorDirective } from './lib/primitives/assistant-modal/assistant-modal-anchor.directive';
export { AuiAssistantModalContentDirective } from './lib/primitives/assistant-modal/assistant-modal-content.directive';
export { AuiSelectionToolbarRootDirective } from './lib/primitives/selection-toolbar/selection-toolbar-root.directive';
export type { SelectionToolbarInfo } from './lib/primitives/selection-toolbar/selection-toolbar-root.directive';
export { AuiSelectionToolbarQuoteDirective } from './lib/primitives/selection-toolbar/selection-toolbar-quote.directive';
export { getSelectionMessageId } from './lib/primitives/selection-toolbar/get-selection-message-id';
export {
  defaultDirectiveFormatter,
  unstable_defaultDirectiveFormatter,
  detectTrigger,
  matchesTriggerItemQuery,
  resolveTriggerMatch,
  type DirectiveFormatter,
  type DirectiveSegment,
  type TriggerAdapter,
  type TriggerBehavior,
  type TriggerCategory,
  type TriggerItem,
  type TriggerMatch,
  type TriggerMatcher,
  type Unstable_DirectiveFormatter,
  type Unstable_DirectiveSegment,
  type Unstable_TriggerAdapter,
  type Unstable_TriggerBehavior,
  type Unstable_TriggerCategory,
  type Unstable_TriggerItem,
  type Unstable_TriggerMatch,
  type Unstable_TriggerMatcher,
} from './lib/primitives/composer-trigger-popover/trigger-contracts';
export {
  AuiComposerTriggerPopoverRootDirective,
  AuiUnstableComposerTriggerPopoverRootDirective,
  injectTriggerPopoverRootContext,
  injectTriggerPopoverRootContextOptional,
  injectTriggerPopoverTriggers,
  injectTriggerPopoverTriggersOptional,
  injectTriggerPopoverAriaProps,
  type ComposerInputPlugin,
  type RegisteredTrigger,
  type TriggerPopoverActiveAria,
  type TriggerPopoverAriaProps,
  type TriggerPopoverLifecycleListener,
  type Unstable_RegisteredTrigger,
  type Unstable_TriggerPopoverAriaProps,
} from './lib/primitives/composer-trigger-popover/trigger-popover-root.directive';
export {
  AuiComposerTriggerPopoverDirective,
  AuiUnstableComposerTriggerPopoverDirective,
  injectTriggerPopoverScopeContext,
  injectTriggerPopoverScopeContextOptional,
  type TriggerActionConfig,
  type TriggerDirectiveConfig,
  type TriggerNavigableEntry,
} from './lib/primitives/composer-trigger-popover/trigger-popover.directive';
export {
  AuiComposerTriggerPopoverCategoriesDirective,
  AuiComposerTriggerPopoverCategoryItemDirective,
  AuiComposerTriggerPopoverItemsDirective,
  AuiComposerTriggerPopoverItemDirective,
  AuiComposerTriggerPopoverBackDirective,
  AuiUnstableComposerTriggerPopoverCategoriesDirective,
  AuiUnstableComposerTriggerPopoverCategoryItemDirective,
  AuiUnstableComposerTriggerPopoverItemsDirective,
  AuiUnstableComposerTriggerPopoverItemDirective,
  AuiUnstableComposerTriggerPopoverBackDirective,
} from './lib/primitives/composer-trigger-popover/trigger-popover-parts.directive';
export { AuiComposerTriggerPopoverInputDirective } from './lib/primitives/composer-trigger-popover/trigger-popover-input.directive';
export {
  injectMentionAdapter,
  type MentionAdapterBundle,
  type Unstable_IconComponent,
  type Unstable_Mention,
  type Unstable_MentionCategory,
  type Unstable_MentionDirective,
  type Unstable_ModelContextToolsOptions,
  type Unstable_UseMentionAdapterOptions,
} from './lib/primitives/composer-trigger-popover/inject-mention-adapter';
export {
  injectSlashCommandAdapter,
  type SlashCommandAdapterBundle,
  type Unstable_SlashCommand,
  type Unstable_SlashCommandAction,
  type Unstable_UseSlashCommandAdapterOptions,
} from './lib/primitives/composer-trigger-popover/inject-slash-command-adapter';
export {
  injectLiveCompletionAdapter,
  type LiveCompletionAdapterBundle,
  type Unstable_UseLiveCompletionAdapterOptions,
} from './lib/primitives/composer-trigger-popover/inject-live-completion-adapter';
