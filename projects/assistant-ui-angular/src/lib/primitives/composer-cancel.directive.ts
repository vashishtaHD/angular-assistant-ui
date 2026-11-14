// Ported from packages/vue/src/primitives/ComposerPrimitiveCancel.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, input } from '@angular/core';
import { composerCancelDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { injectComposerCancelWithFocus } from './composer-input-support';
import { AuiActionButtonHostDirective, injectActionButton } from './action-button';

/**
 * A button that cancels the current run. Disabled while nothing can be
 * cancelled, or when the consumer sets `disabled`.
 */
@Directive({
  selector: 'button[auiComposerCancel]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiComposerCancelDirective {
  private readonly aui = injectAui();
  private readonly cancelWithFocus = injectComposerCancelWithFocus(() =>
    this.aui.composer.cancel(),
  );
  private readonly cancelDisabled = injectAuiState(composerCancelDisabled);

  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.cancelDisabled(),
      onClick: (event) => this.cancelWithFocus(event.currentTarget as HTMLElement),
    });
  }
}
