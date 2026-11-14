// Ported from packages/react/src/primitives/thread/ThreadLoadEarlier.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, input } from '@angular/core';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from './action-button';

/**
 * A button that loads the page before the first loaded message. Disabled
 * while the runtime reports no earlier messages. A press while a page is
 * loading joins that load, so the button stays enabled and keeps keyboard
 * focus until the page lands; read `thread.isLoadingEarlier` to show progress.
 *
 * @example
 * ```html
 * <button auiThreadLoadEarlier>Load earlier messages</button>
 * ```
 */
@Directive({
  selector: 'button[auiThreadLoadEarlier]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiThreadLoadEarlierDirective {
  private readonly aui = injectAui();
  private readonly hasEarlier = injectAuiState((s) => s.thread.hasEarlier);

  /** Consumer-controlled disabled flag, combined with the store state. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || !this.hasEarlier(),
      onClick: () => {
        void this.aui.thread.loadEarlier();
      },
    });
  }
}
