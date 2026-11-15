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
export {
  AuiThreadRootDirective,
  injectThreadRootElementRef,
} from './lib/primitives/thread-root.directive';

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
export {
  AuiThreadViewportDirective,
  type AuiTopAnchorMessageClamp,
} from './lib/primitives/thread-viewport.directive';
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
// Task 8: thread list and thread list item primitives.
export { AuiThreadListRootDirective } from './lib/primitives/thread-list/thread-list-root.directive';
export {
  AuiThreadListItemTemplateDirective,
  AuiThreadListItemsComponent,
} from './lib/primitives/thread-list/thread-list-items.component';
export { AuiThreadListNewDirective } from './lib/primitives/thread-list/thread-list-new.directive';
export { AuiThreadListLoadMoreDirective } from './lib/primitives/thread-list/thread-list-load-more.directive';
export { AuiThreadListItemRootDirective } from './lib/primitives/thread-list/thread-list-item-root.directive';
export { AuiThreadListItemTriggerDirective } from './lib/primitives/thread-list/thread-list-item-trigger.directive';
export { AuiThreadListItemTitleComponent } from './lib/primitives/thread-list/thread-list-item-title.component';
export {
  AuiThreadListItemArchiveDirective,
  AuiThreadListItemUnarchiveDirective,
  AuiThreadListItemDeleteDirective,
} from './lib/primitives/thread-list/thread-list-item-actions.directive';
export {
  ThreadListCollection,
  ThreadListItemFocus,
  injectThreadListCollection,
  injectThreadListItemFocus,
} from './lib/primitives/thread-list/thread-list-focus-group';
// Task 7: suggestions.
export {
  AuiThreadSuggestionsComponent,
  AuiSuggestionTemplateDirective,
} from './lib/primitives/thread-suggestions.component';
export { AuiSuggestionTriggerDirective } from './lib/primitives/suggestion/trigger';
export { AuiSuggestionTitleComponent } from './lib/primitives/suggestion/title';
export { AuiSuggestionDescriptionComponent } from './lib/primitives/suggestion/description';
export { Suggestions, type SuggestionConfig } from '@assistant-ui/core/store';
export {
  createSuggestionAdapter,
  type SuggestionAdapter,
  type SuggestionAdapterGenerateOptions,
  type CreateSuggestionAdapterOptions,
  type ThreadSuggestion,
} from '@assistant-ui/core';
// Task 2: thread extras and scroll lock.
export { AuiThreadViewportFooterDirective } from './lib/primitives/thread-viewport-footer.directive';
export { AuiThreadScrollToBottomDirective } from './lib/primitives/thread-scroll-to-bottom.directive';
export { AuiThreadLoadEarlierDirective } from './lib/primitives/thread-load-earlier.directive';
export {
  AuiThreadRowComponent,
  AuiThreadRowsComponent,
  AuiThreadRowTemplateDirective,
  createThreadRowsSelector,
  type AuiThreadRowGroupPart,
  type AuiThreadRowInfo,
  type AuiThreadRowLeafPart,
  type AuiThreadRowTemplateContext,
  type ThreadRow,
  type ThreadRowsOptions,
} from './lib/primitives/thread-rows.component';
export { injectScrollLock } from './lib/utils/scroll-lock';
// Task 4: action bar, branch picker, feedback, export markdown and edit composer.
export {
  AuiActionBarRootDirective,
  AUI_ACTION_BAR_INTERACTION,
  type AuiActionBarAutohide,
  type AuiActionBarAutohideFloat,
  type AuiActionBarInteraction,
} from './lib/primitives/action-bar/action-bar-root.directive';
export { AuiActionBarCopyDirective } from './lib/primitives/action-bar/action-bar-copy.directive';
export { AUI_CLIPBOARD, type AuiClipboardWriter } from './lib/primitives/action-bar/clipboard';
export { AuiActionBarReloadDirective } from './lib/primitives/action-bar/action-bar-reload.directive';
export { AuiActionBarEditDirective } from './lib/primitives/action-bar/action-bar-edit.directive';
export {
  AuiActionBarFeedbackNegativeDirective,
  AuiActionBarFeedbackPositiveDirective,
} from './lib/primitives/action-bar/action-bar-feedback.directive';
export {
  AuiActionBarExportMarkdownDirective,
  type AuiExportMarkdownEvent,
} from './lib/primitives/action-bar/action-bar-export-markdown.directive';
export type { FeedbackAdapter, SubmitFeedbackOptions } from '@assistant-ui/core';
export {
  AuiBranchPickerCountComponent,
  AuiBranchPickerNextDirective,
  AuiBranchPickerNumberComponent,
  AuiBranchPickerPreviousDirective,
  AuiBranchPickerRootDirective,
} from './lib/primitives/branch-picker/branch-picker';
export { AuiEditComposerDirective } from './lib/primitives/edit-composer/edit-composer.directive';
// Task 9: chain of thought primitives and reasoning grouping.
export { AuiChainOfThoughtAccordionTriggerDirective } from './lib/primitives/chain-of-thought/accordion-trigger';
export { AuiChainOfThoughtPartsComponent } from './lib/primitives/chain-of-thought/parts';
export { AuiChainOfThoughtRootDirective } from './lib/primitives/chain-of-thought/root';
export { AuiChainOfThoughtTemplateDirective } from './lib/primitives/message-parts.component';
// Task 3: message error, grouped parts, quote, and part primitives with smooth streaming.
export { AuiErrorRootDirective, AuiErrorMessageComponent } from './lib/primitives/error.directive';
export { AuiMessageErrorDirective } from './lib/primitives/message-error.directive';
export {
  AuiMessageQuoteDirective,
  injectMessageQuote,
  type AuiMessageQuoteContext,
} from './lib/primitives/message-quote.directive';
export {
  AuiMessageGroupedPartsComponent,
  AuiGroupChildrenComponent,
  AuiEmptyTemplateDirective,
  AuiGroupTemplateDirective,
  AuiIndicatorTemplateDirective,
  type AuiEmptyTemplateContext,
  type AuiGroupBy,
  type AuiGroupPart,
  type AuiGroupTemplateContext,
  type AuiIndicatorMode,
  type AuiIndicatorPart,
  type AuiIndicatorTemplateContext,
} from './lib/primitives/message-grouped-parts.component';
export {
  GROUPBY_MEMO_KEY,
  buildGroupTree,
  getGroupSummary,
  groupMessagePartsByParentId,
  groupPartByType,
  type GroupByContext,
  type GroupCounts,
  type GroupNode,
  type GroupNodeGroup,
  type GroupNodePart,
  type GroupingFunction,
  type PartIndexGroup,
  type GroupPartType,
  type PartState,
  type PartStatus,
} from './lib/utils/group-parts';
export { AuiPartTextComponent } from './lib/primitives/part-text.component';
export { AuiPartImageDirective } from './lib/primitives/part-image.directive';
export { AuiPartInProgressDirective } from './lib/primitives/part-in-progress.directive';
export {
  AuiPartMessagesComponent,
  AuiPartMessagesRowComponent,
} from './lib/primitives/part-messages.component';
export {
  injectMessagePartData,
  injectMessagePartFile,
  injectMessagePartImage,
  injectMessagePartReasoning,
  injectMessagePartSource,
  injectMessagePartText,
  type PartOfType,
} from './lib/primitives/part-state';
export {
  injectMessageStallDetection,
  type MessageStallDetection,
  type MessageStallDetectionOptions,
} from './lib/primitives/message-stall-detection';
export {
  injectSmooth,
  injectSmoothState,
  type SmoothInput,
  type SmoothOptions,
  type SmoothState,
} from './lib/utils/smooth';
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
// Task 6: attachments (attachment scope primitives, composer add/dropzone/list, message list).
export { AuiAttachmentRootDirective } from './lib/primitives/attachment/attachment-root.directive';
export { AuiAttachmentNameComponent } from './lib/primitives/attachment/attachment-name.component';
export { AuiAttachmentThumbDirective } from './lib/primitives/attachment/attachment-thumb.directive';
export {
  AuiAttachmentThumbLabelComponent,
  getAttachmentThumbLabel,
} from './lib/primitives/attachment/attachment-thumb-label.component';
export { AuiAttachmentRemoveDirective } from './lib/primitives/attachment/attachment-remove.directive';
export {
  AuiAttachmentTemplateDirective,
  getAttachmentKeys,
  type AuiAttachmentTemplateContext,
} from './lib/primitives/attachment/attachment-list';
export type { AuiAttachmentError } from './lib/primitives/attachment/inject-add-attachments';
export { AuiComposerAddAttachmentDirective } from './lib/primitives/composer-add-attachment.directive';
export { AuiComposerAttachmentDropzoneDirective } from './lib/primitives/composer-attachment-dropzone.directive';
export { AuiComposerAttachmentsComponent } from './lib/primitives/composer-attachments.component';
export { AuiMessageAttachmentsComponent } from './lib/primitives/message-attachments.component';
export {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type Attachment,
  type AttachmentAdapter,
  type AttachmentRuntime,
  type AttachmentRuntimeState,
  type AttachmentState,
  type AttachmentStatus,
  type CompleteAttachment,
  type CreateAttachment,
  type PendingAttachment,
} from '@assistant-ui/core';
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
  type ExternalMessageConverterOptions,
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

// Task 17: tool-call elapsed time and streaming argument status (used by the styled tool fallback).
export { injectToolCallElapsed } from './lib/tools/tool-call-elapsed';
export {
  computeToolArgsStatus,
  injectToolArgsStatus,
  type ToolArgsStatus,
} from './lib/tools/tool-args-status';
// End Task 17.
