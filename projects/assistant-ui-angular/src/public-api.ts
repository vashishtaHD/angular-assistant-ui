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
