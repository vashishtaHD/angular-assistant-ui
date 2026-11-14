// Ported from packages/vue/src/primitives/useComposerSendState.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive } from '@angular/core';
import { composerSendDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';

/**
 * Marks a `<form>` as the composer root. Submitting the form sends the
 * composer (and prevents the native navigation) unless sending is disabled.
 */
@Directive({
  selector: 'form[auiComposerRoot]',
  standalone: true,
  host: { '(submit)': 'onSubmit($event)' },
})
export class AuiComposerRootDirective {
  private readonly aui = injectAui();
  private readonly sendDisabled = injectAuiState(composerSendDisabled);

  /** @internal */
  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.sendDisabled()) return;
    this.aui.composer.send();
  }
}
