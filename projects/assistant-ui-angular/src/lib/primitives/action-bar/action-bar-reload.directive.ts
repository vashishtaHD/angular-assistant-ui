// Ported from packages/core/src/react/primitive-hooks/useActionBarReload.ts @ 7d74276
import { Directive, booleanAttribute, input } from '@angular/core';
import { actionBarReloadDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/**
 * A button that regenerates the current assistant message. Disabled while a
 * run is in flight, the thread is disabled, or the message is not an
 * assistant message.
 */
@Directive({
  selector: 'button[auiActionBarReload]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiActionBarReloadDirective {
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  private readonly blocked = injectAuiState(actionBarReloadDisabled);

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.aui.message.reload(),
    });
  }
}
