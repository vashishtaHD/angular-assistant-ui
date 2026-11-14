// Ported from packages/react/src/primitives/attachment/AttachmentRemove.ts @ 7d74276
import { Directive, booleanAttribute, input } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/** A button that removes the current attachment from its composer. */
@Directive({
  selector: 'button[auiAttachmentRemove]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiAttachmentRemoveDirective {
  private readonly aui = injectAui();

  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => {
        void this.aui.attachment.remove();
      },
    });
  }
}
