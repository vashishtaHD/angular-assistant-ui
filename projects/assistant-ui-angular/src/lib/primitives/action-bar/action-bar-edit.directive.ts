// Ported from packages/core/src/react/primitive-hooks/useActionBarEdit.ts @ 7d74276
import { Directive, booleanAttribute, input } from '@angular/core';
import { actionBarEditDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/**
 * A button that begins editing the current message. Disabled while already
 * editing, while the message is being submitted, or when the thread cannot edit.
 */
@Directive({
  selector: 'button[auiActionBarEdit]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiActionBarEditDirective {
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  private readonly blocked = injectAuiState(actionBarEditDisabled);

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.aui.composer.beginEdit(),
    });
  }
}
