/*
 * Small internal headless menu: roving focus, Escape, typeahead.
 *
 * Ruling R10: the main entry gets a headless menu in Task 10
 * (`[auiMenuTrigger]` / `[auiMenuContent]` / `[auiMenuItem]`), built in
 * parallel. This file is the stand-in. The styled dropdown menu consumes it only
 * through `hostDirectives` in `dropdown-menu.ts` and through `UI_MENU_HOST`, so
 * switching to Task 10's directives means replacing the two host directives and
 * the trigger's open/close wiring, not the styled API or the CSS.
 *
 * This is NOT exported from the entry's public API.
 */
import {
  DestroyRef,
  Directive,
  ElementRef,
  InjectionToken,
  booleanAttribute,
  contentChildren,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** What the menu content/items need from whatever opened them. */
export interface UiMenuHost {
  /** Closes the menu; `restoreFocus` returns focus to the trigger. */
  close(restoreFocus: boolean): void;
  /** Called by the content directive when it is created. */
  registerContent(content: UiMenuContentDirective): void;
}

/** Provided by the trigger to the portal injector. */
export const UI_MENU_HOST = new InjectionToken<UiMenuHost>('UI_MENU_HOST');

const TYPEAHEAD_RESET_MS = 500;

/** Menu item: `role="menuitem"`, roving tabindex, select on click/Enter/Space. */
@Directive({
  selector: '[auiInternalMenuItem]',
  standalone: true,
  host: {
    role: 'menuitem',
    '[attr.tabindex]': 'tabIndex()',
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-highlighted]': 'highlighted() ? "" : null',
    '(click)': 'select()',
    '(keydown.enter)': '$event.preventDefault(); select()',
    '(keydown.space)': '$event.preventDefault(); select()',
    '(focus)': 'onFocus()',
    '(mouseenter)': 'focus()',
  },
})
export class UiMenuItemDirective {
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly menu = inject<UiMenuContentDirective>(
    forwardRef(() => UiMenuContentDirective),
    {
      optional: true,
    },
  );
  private readonly host = inject(UI_MENU_HOST, { optional: true });

  /** Disabled items are skipped by keyboard navigation and cannot be selected. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Emits when the item is chosen. */
  readonly itemSelect = output<void>();

  protected readonly highlighted = () => this.menu?.active() === this;
  protected readonly tabIndex = () => (this.menu?.active() === this ? 0 : -1);

  /** Moves DOM focus to this item. */
  focus(): void {
    if (this.disabled()) return;
    this.element.focus();
  }

  protected onFocus(): void {
    this.menu?.active.set(this);
  }

  protected select(): void {
    if (this.disabled()) return;
    this.itemSelect.emit();
    this.host?.close(true);
  }
}

/** Menu surface: `role="menu"`, arrow/Home/End navigation, typeahead and Escape. */
@Directive({
  selector: '[auiInternalMenuContent]',
  standalone: true,
  host: {
    role: 'menu',
    'aria-orientation': 'vertical',
    '(keydown)': 'onKeydown($event)',
  },
})
export class UiMenuContentDirective {
  private readonly host = inject(UI_MENU_HOST, { optional: true });
  private readonly items = contentChildren(UiMenuItemDirective, { descendants: true });

  /** The item that currently owns the roving tab stop. */
  readonly active = signal<UiMenuItemDirective | null>(null);

  private typed = '';
  private typedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.host?.registerContent(this);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.typedTimer));
  }

  /** Focuses the first enabled item. */
  focusFirst(): void {
    this.focusAt(0, 1);
  }

  /** Focuses the last enabled item. */
  focusLast(): void {
    this.focusAt(this.items().length - 1, -1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        return;
      case 'Home':
        event.preventDefault();
        this.focusFirst();
        return;
      case 'End':
        event.preventDefault();
        this.focusLast();
        return;
      case 'Escape':
        event.preventDefault();
        this.host?.close(true);
        return;
      case 'Tab':
        event.preventDefault();
        this.host?.close(true);
        return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.typeahead(event.key);
    }
  }

  private move(step: 1 | -1): void {
    const items = this.items();
    if (!items.length) return;
    const current = this.active();
    const from = current ? items.indexOf(current) : step === 1 ? -1 : items.length;
    this.focusAt(from + step, step);
  }

  /** Focuses the first enabled item at or after `index`, walking by `step` and wrapping. */
  private focusAt(index: number, step: 1 | -1): void {
    const items = this.items();
    const count = items.length;
    for (let i = 0; i < count; i++) {
      const item = items[(((index + i * step) % count) + count) % count];
      if (!item.disabled()) {
        item.focus();
        return;
      }
    }
  }

  private typeahead(char: string): void {
    clearTimeout(this.typedTimer);
    this.typed += char.toLowerCase();
    this.typedTimer = setTimeout(() => (this.typed = ''), TYPEAHEAD_RESET_MS);

    const items = this.items();
    const current = this.active();
    const start = current ? items.indexOf(current) : -1;
    // A single character moves past the current item; a longer prefix may keep it.
    const offset = this.typed.length === 1 ? 1 : 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[(start + offset + i + items.length) % items.length];
      if (item.disabled()) continue;
      const text = (item.element.textContent ?? '').trim().toLowerCase();
      if (text.startsWith(this.typed)) {
        item.focus();
        return;
      }
    }
  }
}
