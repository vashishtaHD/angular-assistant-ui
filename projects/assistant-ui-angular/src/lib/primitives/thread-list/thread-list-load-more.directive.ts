// Ported from packages/react/src/primitives/threadList/ThreadListLoadMore.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, input } from '@angular/core';
import { threadListLoadMoreDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/**
 * A button that loads the next page of threads. It stays mounted and is
 * disabled while no more threads are available or a load is in flight.
 */
@Directive({
  selector: 'button[auiThreadListLoadMore]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiThreadListLoadMoreDirective {
  private readonly aui = injectAui();
  private readonly blocked = injectAuiState(threadListLoadMoreDisabled);

  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => void this.aui.threads.loadMore(),
    });
  }
}
