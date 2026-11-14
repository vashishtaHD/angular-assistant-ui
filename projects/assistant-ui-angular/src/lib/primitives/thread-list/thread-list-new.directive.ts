// Ported from packages/react/src/primitives/threadList/ThreadListNew.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, input } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/**
 * A button that switches to a new thread. Carries `data-active` and
 * `aria-current` while the new thread is the main one.
 */
@Directive({
  selector: 'button[auiThreadListNew]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
  host: {
    '[attr.data-active]': "active() ? 'true' : null",
    '[attr.aria-current]': "active() ? 'true' : null",
  },
})
export class AuiThreadListNewDirective {
  private readonly aui = injectAui();
  /** True while the new thread is the main thread. */
  protected readonly active = injectAuiState(
    (s) => s.threads.newThreadId === s.threads.mainThreadId,
  );

  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.threads.switchToNewThread(),
    });
  }
}
