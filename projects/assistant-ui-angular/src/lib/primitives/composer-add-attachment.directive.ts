// Ported from packages/react/src/primitives/composer/ComposerAddAttachment.ts @ 7d74276
import { Directive, booleanAttribute, input, output } from '@angular/core';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import {
  injectAttachmentAdder,
  type AuiAttachmentError,
} from './attachment/inject-add-attachments';
import { AuiActionButtonHostDirective, injectActionButton } from './action-button';

/**
 * A button that opens a file picker (a hidden `<input type="file">` using the
 * composer's `attachmentAccept`) and adds the selected files to the composer.
 * Disabled while the thread is disabled or the composer is not editing. A
 * selection made after the thread changed is dropped. Rejected files are
 * reported through `(attachmentError)`.
 *
 * @example
 * ```html
 * <button auiComposerAddAttachment (attachmentError)="toast($event.message)">Attach</button>
 * ```
 */
@Directive({
  selector: 'button[auiComposerAddAttachment]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiComposerAddAttachmentDirective {
  private readonly aui = injectAui();
  private readonly blocked = injectAuiState((s) => s.thread.isDisabled || !s.composer.isEditing);

  /** Whether the picker allows selecting several files. */
  readonly multiple = input(true, { transform: booleanAttribute });
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Emits when a file is rejected or its upload fails. */
  readonly attachmentError = output<AuiAttachmentError>();

  private readonly adder = injectAttachmentAdder((error) => this.attachmentError.emit(error));

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.openPicker(),
    });
  }

  private openPicker(): void {
    const token = this.adder.token();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = this.multiple();
    input.hidden = true;
    const accept = this.aui.composer.getState().attachmentAccept;
    if (accept !== '*') input.accept = accept;
    document.body.appendChild(input);
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      this.adder.add(files, token);
    };
    input.oncancel = () => input.remove();
    input.click();
  }
}
