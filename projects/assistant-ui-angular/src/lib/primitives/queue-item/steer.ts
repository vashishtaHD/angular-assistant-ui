// Ported from packages/react/src/primitives/queueItem/QueueItemSteer.ts @ 7d74276
import { Directive, booleanAttribute, input } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/** A button that runs this queue item next, interrupting the current run when possible. */
@Directive({
  selector: 'button[auiQueueItemSteer]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiQueueItemSteerDirective {
  private readonly aui = injectAui();
  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.queueItem.steer(),
    });
  }
}
