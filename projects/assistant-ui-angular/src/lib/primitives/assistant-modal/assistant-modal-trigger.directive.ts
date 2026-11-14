// Ported from packages/react/src/primitives/assistantModal/AssistantModalTrigger.tsx @ 7d74276
import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AuiAssistantModalRootDirective } from './assistant-modal-root.directive';

/**
 * The button that toggles the assistant modal. Sets `aria-haspopup="dialog"`,
 * `aria-expanded` and `aria-controls`.
 */
@Directive({
  selector: 'button[auiAssistantModalTrigger]',
  standalone: true,
  host: {
    type: 'button',
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'root.open()',
    '[attr.aria-controls]': 'root.open() ? root.contentId : null',
    '[attr.data-state]': 'root.open() ? "open" : "closed"',
    '(click)': 'onClick($event)',
  },
})
export class AuiAssistantModalTriggerDirective {
  /** @internal */
  protected readonly root = inject(AuiAssistantModalRootDirective);

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    this.root.trigger = el;
    inject(DestroyRef).onDestroy(() => {
      if (this.root.trigger === el) this.root.trigger = null;
    });
  }

  /** @internal */
  protected onClick(event: MouseEvent): void {
    if (!event.defaultPrevented) this.root.toggle();
  }
}
