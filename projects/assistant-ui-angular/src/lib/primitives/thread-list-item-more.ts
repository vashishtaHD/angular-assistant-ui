// Ported from packages/react/src/primitives/threadListItemMore/*.tsx @ 7d74276
import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { AuiMenuContentDirective } from './menu/menu-content.directive';
import { AuiMenuItemDirective } from './menu/menu-item.directive';
import { AuiMenuRootDirective } from './menu/menu-root.directive';
import { AuiMenuSeparatorDirective } from './menu/menu-separator.directive';
import { AuiMenuTriggerDirective } from './menu/menu-trigger.directive';
import { injectThreadListItemFocus } from './thread-list/thread-list-focus-group';

/**
 * Root of a thread list item's "more" menu. A thin alias of `[auiMenuRoot]`
 * (inputs `open` / `openChange`).
 *
 * Set `sharedFocusGroup` when the trigger lives in a horizontal roving focus
 * group (the thread list): ArrowRight on the trigger opens the menu and
 * ArrowLeft inside it closes the menu and refocuses the trigger (mirrored in
 * RTL), as upstream does.
 */
@Directive({
  selector: '[auiThreadListItemMoreRoot]',
  standalone: true,
  exportAs: 'auiThreadListItemMoreRoot',
  hostDirectives: [
    {
      directive: AuiMenuRootDirective,
      inputs: ['open', 'sideKeys: sharedFocusGroup'],
      outputs: ['openChange'],
    },
  ],
})
export class AuiThreadListItemMoreRootDirective {
  /** The underlying headless menu root. */
  readonly menu = inject(AuiMenuRootDirective);
}

/**
 * Trigger of a thread list item's "more" menu. An alias of `button[auiMenuTrigger]`.
 *
 * Inside an `[auiThreadListItemRoot]` it registers as the item's "more" button,
 * so the inline-forward arrow (ArrowRight, ArrowLeft in RTL) on the item
 * trigger moves focus here and the opposite arrow moves it back.
 */
@Directive({
  selector: 'button[auiThreadListItemMoreTrigger]',
  standalone: true,
  hostDirectives: [AuiMenuTriggerDirective],
})
export class AuiThreadListItemMoreTriggerDirective {
  constructor() {
    const element = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
    const focus = injectThreadListItemFocus();
    if (!focus) return;
    afterNextRender(() => focus.more.set(element));
    inject(DestroyRef).onDestroy(() => {
      if (focus.more() === element) focus.more.set(null);
    });
  }
}

/** Popup of a thread list item's "more" menu. An alias of `[auiMenuContent]`. */
@Directive({
  selector: '[auiThreadListItemMoreContent]',
  standalone: true,
  hostDirectives: [AuiMenuContentDirective],
})
export class AuiThreadListItemMoreContentDirective {}

/**
 * Item of a thread list item's "more" menu. An alias of `[auiMenuItem]` (inputs
 * `disabled`, `closeOnSelect`; output `select`).
 */
@Directive({
  selector: '[auiThreadListItemMoreItem]',
  standalone: true,
  hostDirectives: [
    {
      directive: AuiMenuItemDirective,
      inputs: ['disabled', 'closeOnSelect'],
      outputs: ['select'],
    },
  ],
})
export class AuiThreadListItemMoreItemDirective {}

/** Separator of a thread list item's "more" menu. An alias of `[auiMenuSeparator]`. */
@Directive({
  selector: '[auiThreadListItemMoreSeparator]',
  standalone: true,
  hostDirectives: [AuiMenuSeparatorDirective],
})
export class AuiThreadListItemMoreSeparatorDirective {}
