// Ported from packages/react/src/primitives/assistantModal/AssistantModalContent.tsx @ 7d74276
import { DestroyRef, Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';
import { AuiAssistantModalRootDirective } from './assistant-modal-root.directive';

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The modal window: `role="dialog"`, hidden while the modal is closed. When it
 * opens, focus moves to the first tabbable element inside (or the dialog
 * itself). Escape (handled on the document, so it works wherever focus is) closes
 * it and returns focus to the trigger; a pointer-down
 * outside the content, trigger and anchor dismisses it only when
 * `dismissOnInteractOutside` is true.
 *
 * `side` and `align` are exposed as `data-side` / `data-align` for the
 * consumer's positioning.
 */
@Directive({
  selector: '[auiAssistantModalContent]',
  standalone: true,
  host: {
    role: 'dialog',
    tabindex: '-1',
    '[id]': 'root.contentId',
    '[hidden]': '!root.open()',
    '[attr.data-state]': 'root.open() ? "open" : "closed"',
    '[attr.data-side]': 'side()',
    '[attr.data-align]': 'align()',
  },
})
export class AuiAssistantModalContentDirective {
  /** @internal */
  protected readonly root = inject(AuiAssistantModalRootDirective);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Preferred side of the anchor (default `top`). */
  readonly side = input<'top' | 'right' | 'bottom' | 'left'>('top');
  /** Preferred alignment against the anchor (default `end`). */
  readonly align = input<'start' | 'center' | 'end'>('end');
  /**
   * Close on a pointer-down outside the modal. Defaults to false, as upstream
   * (`dissmissOnInteractOutside`, sic): clicking the page keeps the chat open.
   */
  readonly dismissOnInteractOutside = input(false, { transform: booleanAttribute });

  constructor() {
    this.root.content = this;
    this.root.focusOnCreate();
    inject(DestroyRef).onDestroy(() => {
      if (this.root.content === this) this.root.content = null;
    });
  }

  /** @internal */
  contains(node: Node): boolean {
    return this.el.contains(node);
  }

  /** @internal */
  focusInitial(): void {
    const first = this.el.querySelector<HTMLElement>(TABBABLE);
    (first ?? this.el).focus({ preventScroll: true });
  }
}
