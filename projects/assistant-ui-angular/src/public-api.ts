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
