/*
 * Public API Surface of angular-assistant-ui/ui.
 * The styled kit: components styled by one plain-CSS stylesheet
 * (`angular-assistant-ui/ui/styles.css`). Needs the optional `@angular/cdk` peer;
 * `aui-thread` and `aui-markdown-text-styled` render through the
 * `angular-assistant-ui/markdown` entry, so they also need its optional peers
 * `markdown-it` and `@angular/platform-browser`.
 */
export { AUI_ICON_NAMES, AUI_ICON_SHAPES } from './icons/icon-shapes';
export type { AuiIconName, AuiIconShape } from './icons/icon-shapes';
export { AuiIconComponent } from './icons/icon.component';

export { AuiButtonDirective } from './button.directive';
export type { AuiButtonSize, AuiButtonVariant } from './button.directive';

export {
  AuiTooltipDirective,
  AuiTooltipIconButtonComponent,
  AuiTooltipPanelComponent,
} from './tooltip-icon-button.component';
export type { AuiTooltipSide } from './tooltip-icon-button.component';

export {
  AuiCollapsibleComponent,
  AuiCollapsibleContentComponent,
  AuiCollapsibleTriggerDirective,
} from './collapsible/collapsible';

export { AuiDialogCloseDirective, AuiDialogService } from './dialog/dialog';
export type { AuiDialogConfig } from './dialog/dialog';

export {
  AuiDropdownMenuContentDirective,
  AuiDropdownMenuItemDirective,
  AuiDropdownMenuLabelDirective,
  AuiDropdownMenuSeparatorDirective,
  AuiDropdownMenuTriggerDirective,
} from './dropdown-menu/dropdown-menu';
export type { AuiDropdownMenuAlign } from './dropdown-menu/dropdown-menu';

// Task 17: tool fallback (approval card, approval receipt, ask-user form), tool group,
// reasoning and styled attachments.
export {
  AuiToolFallbackComponent,
  AuiToolFallbackToolUIComponent,
} from './tool-fallback/tool-fallback.component';
export { AuiToolFallbackApprovalComponent } from './tool-fallback/tool-fallback-approval.component';
export { AuiToolFallbackAskUserComponent } from './tool-fallback/tool-fallback-ask-user.component';
export {
  AUI_TOOL_APPROVED_RESULT,
  AUI_TOOL_DENIED_RESULT,
  approvalOptionLabel,
  formatToolDuration,
  formatUnknownValue,
  isAskUserArgs,
  isPendingAskUser,
  offersInterruptAction,
} from './tool-fallback/tool-fallback-utils';
export type {
  AuiAskUserArgs,
  AuiToolApproval,
  AuiToolCallPart,
} from './tool-fallback/tool-fallback-utils';
export { AuiToolGroupComponent } from './tool-group.component';
export type { AuiToolGroupVariant } from './tool-group.component';
export { AuiReasoningComponent, AuiReasoningGroupComponent } from './reasoning.component';
export { injectAttachmentSrc } from './attachments/attachment-src';
export { AuiAttachmentTileComponent } from './attachments/attachment-tile.component';
export {
  AuiComposerAddAttachmentStyledComponent,
  AuiComposerAttachmentsStyledComponent,
  AuiMessageAttachmentsStyledComponent,
} from './attachments/attachments.component';
// End Task 17.

// Task 16: styled thread, messages, composer, action bars, branch picker and markdown text.
export { AuiThreadComponent } from './thread/thread.component';
export type {
  AuiThreadAvatar,
  AuiThreadWelcomeConfig,
  AuiThreadWelcomeSuggestion,
} from './thread/thread.component';
export { AUI_THREAD_COMPONENTS } from './thread-components.token';
export type { AuiThreadComponents } from './thread-components.token';
export { AuiStyledCodeHeader, AuiStyledMarkdownText } from './markdown-text.component';
// Task 16 end.
// Task 18: thread list, sidebar, assistant modal, quote, follow-ups, timing and trigger popover.
export { AuiThreadListComponent } from './thread-list/thread-list.component';
export {
  groupThreadList,
  injectThreadListGroups,
  startOfLocalDay,
} from './thread-list/thread-list-groups';
export type {
  ThreadListGroup,
  ThreadListGroupLabel,
  ThreadListGroups,
} from './thread-list/thread-list-groups';
export { AuiThreadListSidebarComponent } from './thread-list-sidebar.component';
export type { AuiSidebarCollapsible } from './thread-list-sidebar.component';
export { AuiAssistantModalComponent } from './assistant-modal.component';
export {
  AuiQuoteBlockComponent,
  AuiQuoteComposerComponent,
  AuiSelectionToolbarStyledComponent,
} from './quote/quote';
export { AuiFollowUpSuggestionsComponent } from './follow-up-suggestions.component';
export { AuiMessageTimingComponent, formatTimingMs } from './message-timing.component';
export { AuiComposerTriggerPopoverStyledComponent } from './composer-trigger-popover.component';
// Task 18 end.
