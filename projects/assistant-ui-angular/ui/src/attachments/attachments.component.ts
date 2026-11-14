// Ported from packages/ui/src/components/react/assistant-ui/elements/attachment.aui.tsx @ 7d74276
// (UserMessageAttachments, ComposerAttachments and ComposerAddAttachment)
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  booleanAttribute,
  input,
  output,
} from '@angular/core';
import {
  AuiAttachmentTemplateDirective,
  AuiComposerAddAttachmentDirective,
  AuiComposerAttachmentsComponent,
  AuiMessageAttachmentsComponent,
  type AuiAttachmentError,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import { AuiIconComponent } from '../icons/icon.component';
import { AuiAttachmentTileComponent } from './attachment-tile.component';

/**
 * The composer's pending attachments as a horizontally scrolling row of
 * `aui-attachment-tile`s, each with a remove button and, for images, a
 * preview dialog. Hidden while there are none. Place it inside the composer.
 *
 * @example
 * ```html
 * <form auiComposerRoot>
 *   <aui-composer-attachments-styled />
 *   <textarea auiComposerInput></textarea>
 *   <aui-composer-add-attachment-styled />
 * </form>
 * ```
 */
@Component({
  selector: 'aui-composer-attachments-styled',
  standalone: true,
  imports: [
    AuiComposerAttachmentsComponent,
    AuiAttachmentTemplateDirective,
    AuiAttachmentTileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-composer-attachments' },
  template: `
    <aui-composer-attachments>
      <ng-template auiAttachment><aui-attachment-tile /></ng-template>
    </aui-composer-attachments>
  `,
})
export class AuiComposerAttachmentsStyledComponent {}

/**
 * A user message's attachments as a right-aligned row of
 * `aui-attachment-tile`s (no remove button), with a preview dialog for
 * images. Renders nothing for other messages. Place it inside a message
 * template.
 */
@Component({
  selector: 'aui-message-attachments-styled',
  standalone: true,
  imports: [
    AuiMessageAttachmentsComponent,
    AuiAttachmentTemplateDirective,
    AuiAttachmentTileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-message-attachments' },
  template: `
    <aui-message-attachments>
      <ng-template auiAttachment><aui-attachment-tile /></ng-template>
    </aui-message-attachments>
  `,
})
export class AuiMessageAttachmentsStyledComponent {}

/**
 * A round ghost icon button ("Add Attachment") that opens the file picker and
 * adds the chosen files to the composer (`button[auiComposerAddAttachment]`).
 * Rejected files are reported through `(attachmentError)`.
 */
@Component({
  selector: 'aui-composer-add-attachment-styled',
  standalone: true,
  imports: [AuiComposerAddAttachmentDirective, AuiButtonDirective, AuiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-composer-add-attachment-host' },
  template: `
    <button
      auiButton
      auiComposerAddAttachment
      variant="ghost"
      size="icon"
      class="aui-composer-add-attachment"
      aria-label="Add Attachment"
      title="Add Attachment"
      [multiple]="multiple()"
      (attachmentError)="attachmentError.emit($event)"
    >
      <aui-icon name="plus" />
    </button>
  `,
})
export class AuiComposerAddAttachmentStyledComponent {
  /** Whether the picker allows selecting several files. Default true. */
  readonly multiple = input(true, { transform: booleanAttribute });
  /** Emits when a file is rejected or its upload fails. */
  readonly attachmentError = output<AuiAttachmentError>();
}
