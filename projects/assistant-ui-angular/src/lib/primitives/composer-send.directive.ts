// Ported from packages/vue/src/primitives/ComposerPrimitiveSend.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, input } from '@angular/core';
import { composerSendDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from './action-button';

/**
 * A button that sends the composer. Disabled while the composer cannot send,
 * while a run is in flight and the runtime does not queue sends, or when the
 * consumer sets `disabled`.
 */
@Directive({
  selector: 'button[auiComposerSend]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiComposerSendDirective {
  private readonly aui = injectAui();
  private readonly sendDisabled = injectAuiState(composerSendDisabled);

  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.sendDisabled(),
      onClick: () => this.aui.composer.send(),
    });
  }
}
