// Ported from packages/react/src/primitives/composer/{ComposerInput.tsx,useComposerInputState.ts} @ 7d74276
import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import {
  injectTriggerPopoverAriaProps,
  injectTriggerPopoverRootContext,
} from './trigger-popover-root.directive';

/**
 * Connects the composer textarea to the trigger popovers of the enclosing
 * `[auiComposerTriggerPopoverRoot]`. Put it on the same element as
 * `[auiComposerInput]`:
 *
 * - it feeds key presses to the popovers first (ArrowUp/ArrowDown, Enter/Tab,
 *   Escape, Backspace) and swallows the keys they consume, so the composer's own
 *   Enter-to-send handler does not also run;
 * - it reports the caret position on input, select, click, keyup and focus (not
 *   during IME composition);
 * - while a popover is open it sets `aria-controls`, `aria-expanded`,
 *   `aria-haspopup="listbox"` and `aria-activedescendant` (editable combobox).
 *
 * It listens in the capture phase so it runs before `[auiComposerInput]`'s
 * key handler regardless of directive order.
 */
@Directive({
  selector: 'textarea[auiComposerTriggerPopoverInput]',
  standalone: true,
  host: {
    '[attr.aria-controls]': 'aria()["aria-controls"] ?? null',
    '[attr.aria-expanded]': 'aria()["aria-expanded"] ?? null',
    '[attr.aria-haspopup]': 'aria()["aria-haspopup"] ?? null',
    '[attr.aria-activedescendant]': 'aria()["aria-activedescendant"] ?? null',
    '(compositionstart)': 'composing = true',
    '(compositionend)': 'onCompositionEnd()',
    '(input)': 'reportCursor($event)',
    '(select)': 'reportCursor($event)',
    '(click)': 'reportCursor($event)',
    '(keyup)': 'reportCursor($event)',
    '(focus)': 'reportCursor($event)',
  },
})
export class AuiComposerTriggerPopoverInputDirective {
  private readonly root = injectTriggerPopoverRootContext();
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  /** @internal */
  protected readonly aria = injectTriggerPopoverAriaProps();
  /** @internal */
  protected composing = false;
  private lastPosition = -1;

  constructor() {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      for (const plugin of this.root.getPlugins()) {
        if (plugin.handleKeyDown(event)) {
          event.stopImmediatePropagation();
          return;
        }
      }
    };
    this.el.addEventListener('keydown', onKeydown, true);
    inject(DestroyRef).onDestroy(() => this.el.removeEventListener('keydown', onKeydown, true));
  }

  /** @internal */
  protected onCompositionEnd(): void {
    this.composing = false;
    this.broadcast();
  }

  /** @internal */
  protected reportCursor(event: Event): void {
    if (this.composing || (event as InputEvent).isComposing) return;
    // Only text edits and real caret moves are reported; a key that leaves the caret
    // where it was (Escape, a swallowed Enter) must not reopen a popover that was just closed.
    const pos = this.el.selectionStart ?? this.el.value.length;
    if (event.type !== 'input' && pos === this.lastPosition) return;
    this.broadcast();
  }

  private broadcast(): void {
    const pos = this.el.selectionStart ?? this.el.value.length;
    this.lastPosition = pos;
    for (const plugin of this.root.getPlugins()) plugin.setCursorPosition(pos);
  }
}
