// Ported from packages/react/src/primitives/dropdownMenuRenderPrimitives.ts @ 7d74276
import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AuiMenuRootDirective } from './menu-root.directive';

/**
 * The button that opens and closes a menu. Sets `aria-haspopup="menu"`,
 * `aria-expanded` and `aria-controls`. A click toggles the menu; ArrowDown and
 * ArrowUp open it with the first or last item focused.
 *
 * Must be inside an `[auiMenuRoot]`.
 */
@Directive({
  selector: 'button[auiMenuTrigger]',
  standalone: true,
  host: {
    type: 'button',
    'aria-haspopup': 'menu',
    '[attr.aria-expanded]': 'root.open()',
    '[attr.aria-controls]': 'root.open() ? root.contentId : null',
    '[attr.data-state]': 'root.open() ? "open" : "closed"',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class AuiMenuTriggerDirective {
  /** @internal */
  protected readonly root = inject(AuiMenuRootDirective);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    this.root.trigger = this.el;
    inject(DestroyRef).onDestroy(() => {
      if (this.root.trigger === this.el) this.root.trigger = null;
    });
  }

  /** @internal */
  protected onClick(event: MouseEvent): void {
    if (event.defaultPrevented) return;
    // detail 0 means a keyboard-initiated click: land on the first item.
    this.root.toggle({ focus: event.detail === 0 ? 'first' : 'content' });
  }

  /** @internal */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.root.setOpen(true, { focus: event.key === 'ArrowDown' ? 'first' : 'last' });
    } else if (this.root.sideKeys() && !event.shiftKey && event.key === this.openKey()) {
      event.preventDefault();
      this.root.setOpen(true, { focus: 'first' });
    }
  }

  private openKey(): string {
    return getComputedStyle(this.el).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  }
}
