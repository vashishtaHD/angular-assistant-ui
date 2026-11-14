// Ported from packages/vue/src/primitives/ComposerPrimitiveCancel.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, input } from '@angular/core';
import { composerCancelDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';

/**
 * A button that cancels the current run. Disabled while nothing can be
 * cancelled, or when the consumer sets `disabled`.
 */
@Directive({
  selector: 'button[auiComposerCancel]',
  standalone: true,
  host: {
    type: 'button',
    '[disabled]': 'isDisabled()',
    '(click)': 'onClick($event)',
  },
})
export class AuiComposerCancelDirective {
  private readonly aui = injectAui();
  private readonly cancelDisabled = injectAuiState(composerCancelDisabled);

  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** @internal */
  isDisabled(): boolean {
    return this.disabled() || this.cancelDisabled();
  }

  /** @internal */
  onClick(event: MouseEvent): void {
    if (event.defaultPrevented || this.isDisabled()) return;
    this.aui.composer.cancel();
  }
}
