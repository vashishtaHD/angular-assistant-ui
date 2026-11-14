// Ported from packages/react/src/primitives/dropdownMenuRenderPrimitives.ts @ 7d74276
import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { AuiMenuRootDirective, type AuiMenuInitialFocus } from './menu-root.directive';

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';
const TYPEAHEAD_RESET_MS = 500;

/**
 * The popup of a menu: `role="menu"` with roving focus over its
 * `[auiMenuItem]` children. ArrowDown/ArrowUp move (and wrap), Home/End jump to
 * the ends, printable characters run a typeahead search, Escape closes the menu
 * and returns focus to the trigger, and Tab closes it too. It is hidden while
 * the menu is closed (`hidden`, plus an inline `display: none` so a utility
 * class such as `.flex` cannot show it).
 *
 * Must be inside an `[auiMenuRoot]` (declared there, it can still be rendered
 * elsewhere, for example in an overlay).
 */
@Directive({
  selector: '[auiMenuContent]',
  standalone: true,
  host: {
    role: 'menu',
    tabindex: '-1',
    '[id]': 'root.contentId',
    '[hidden]': '!root.open()',
    '[style.display]': 'root.open() ? null : "none"',
    '[attr.data-state]': 'root.open() ? "open" : "closed"',
    '(keydown)': 'onKeydown($event)',
  },
})
export class AuiMenuContentDirective {
  /** @internal */
  protected readonly root = inject(AuiMenuRootDirective);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private typeahead = '';
  private typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.root.content = this;
    this.root.focusOnCreate();
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.typeaheadTimer);
      if (this.root.content === this) this.root.content = null;
    });
  }

  /** @internal True while a typeahead search is in progress (Space then extends it). */
  isTypingAhead(): boolean {
    return this.typeahead !== '';
  }

  /** @internal */
  contains(node: Node): boolean {
    return this.el.contains(node);
  }

  /** @internal */
  focusInitial(target: AuiMenuInitialFocus): void {
    const items = this.items();
    const item =
      target === 'first' ? items[0] : target === 'last' ? items[items.length - 1] : undefined;
    // With no enabled item, focus the content itself so Escape/Tab still reach it.
    (item ?? this.el).focus({ preventScroll: true });
  }

  private items(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
  }

  /** @internal */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    const items = this.items();
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[current < 0 || current === items.length - 1 ? 0 : current + 1]?.focus();
        return;
      case 'ArrowUp':
        event.preventDefault();
        items[current <= 0 ? items.length - 1 : current - 1]?.focus();
        return;
      case 'Home':
        event.preventDefault();
        items[0]?.focus();
        return;
      case 'End':
        event.preventDefault();
        items[items.length - 1]?.focus();
        return;
      case 'Escape':
      case 'Tab':
        event.preventDefault();
        this.root.setOpen(false, { restoreFocus: true });
        return;
    }
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    if (this.root.sideKeys() && plain && !event.shiftKey && event.key === this.closeKey()) {
      event.preventDefault();
      this.root.setOpen(false, { restoreFocus: true });
      return;
    }
    if (event.key.length === 1 && plain) {
      if (event.key === ' ' && this.typeahead === '') return;
      this.runTypeahead(event.key, items, current);
    }
  }

  private closeKey(): string {
    return getComputedStyle(this.el).direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  }

  private runTypeahead(char: string, items: HTMLElement[], current: number): void {
    clearTimeout(this.typeaheadTimer);
    this.typeaheadTimer = setTimeout(() => (this.typeahead = ''), TYPEAHEAD_RESET_MS);
    this.typeahead += char.toLowerCase();
    const buffer = this.typeahead;
    const repeated = buffer.split('').every((c) => c === buffer[0]);
    const query = repeated ? buffer[0]! : buffer;
    // A repeated single character cycles forward; a longer query matches from the current item.
    const start = repeated ? current + 1 : Math.max(current, 0);
    const ordered = [...items.slice(start), ...items.slice(0, start)];
    const match = ordered.find((item) =>
      (item.textContent ?? '').trim().toLowerCase().startsWith(query),
    );
    match?.focus();
  }
}
