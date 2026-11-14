// Ported from packages/react/src/primitives/dropdownMenuRenderPrimitives.ts @ 7d74276
import { Directive, ElementRef, booleanAttribute, inject, input, output } from '@angular/core';
import { AuiMenuRootDirective } from './menu-root.directive';

/**
 * One action in a menu: `role="menuitem"`, focusable by the content's roving
 * focus (never by Tab). Activating it by click, Enter or Space emits `select`
 * with the originating event and closes the menu, returning focus to the
 * trigger. Call `event.preventDefault()` in the `select` handler, or set
 * `closeOnSelect` to false, to keep the menu open.
 */
@Directive({
  selector: '[auiMenuItem]',
  standalone: true,
  host: {
    role: 'menuitem',
    tabindex: '-1',
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
    '(keyup)': 'onKeyup($event)',
    '(pointermove)': 'onPointermove()',
  },
})
export class AuiMenuItemDirective {
  private readonly root = inject(AuiMenuRootDirective);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Disables the item: it is skipped by keyboard navigation and does not select. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Close the menu after selecting. */
  readonly closeOnSelect = input(true, { transform: booleanAttribute });
  /** Emits when the item is activated. */
  readonly select = output<Event>();

  /** @internal */
  protected onClick(event: MouseEvent): void {
    if (this.disabled()) {
      event.preventDefault();
      return;
    }
    this.select.emit(event);
    if (!event.defaultPrevented && this.closeOnSelect()) {
      this.root.setOpen(false, { restoreFocus: true });
    }
  }

  /** @internal */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Mid-typeahead, Space extends the search (handled by the content) instead of selecting.
    if (event.key === ' ' && this.root.content?.isTypingAhead()) return;
    event.preventDefault();
    this.el.click();
  }

  /** @internal */
  protected onKeyup(event: KeyboardEvent): void {
    // Some browsers click a button on Space keyup even after keydown was handled.
    if (event.key === ' ') event.preventDefault();
  }

  /** @internal */
  protected onPointermove(): void {
    if (!this.disabled() && document.activeElement !== this.el) {
      this.el.focus({ preventScroll: true });
    }
  }
}
