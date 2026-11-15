// Ported from packages/react/src/primitives/assistantModal/AssistantModalAnchor.tsx @ 7d74276
import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AuiAssistantModalRootDirective } from './assistant-modal-root.directive';

/**
 * Marks the element the modal content is positioned against. The headless
 * primitive does not position anything; a styled kit reads the anchor's
 * element (for example as a CDK overlay origin). Clicks on the anchor do not
 * count as outside clicks.
 */
@Directive({
  selector: '[auiAssistantModalAnchor]',
  standalone: true,
  exportAs: 'auiAssistantModalAnchor',
  host: { '[attr.data-state]': 'root.open() ? "open" : "closed"' },
})
export class AuiAssistantModalAnchorDirective {
  /** @internal */
  protected readonly root = inject(AuiAssistantModalRootDirective);
  /** The anchor element. */
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    this.root.anchor = this.element;
    inject(DestroyRef).onDestroy(() => {
      if (this.root.anchor === this.element) this.root.anchor = null;
    });
  }
}
