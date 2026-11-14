// Ported from packages/react/src/primitives/queueItem/QueueItemRemove.ts @ 7d74276
import { Directive, booleanAttribute, input } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/** A button that removes this item from the queue. */
@Directive({
  selector: 'button[auiQueueItemRemove]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiQueueItemRemoveDirective {
  private readonly aui = injectAui();
  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.queueItem.remove(),
    });
  }
}
