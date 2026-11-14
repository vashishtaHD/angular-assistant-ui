// Ported from packages/react/src/primitives/threadListItemMore/*.tsx @ 7d74276
import { Directive, inject } from '@angular/core';
import { AuiMenuContentDirective } from './menu/menu-content.directive';
import { AuiMenuItemDirective } from './menu/menu-item.directive';
import { AuiMenuRootDirective } from './menu/menu-root.directive';
import { AuiMenuSeparatorDirective } from './menu/menu-separator.directive';
import { AuiMenuTriggerDirective } from './menu/menu-trigger.directive';

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

/** Trigger of a thread list item's "more" menu. An alias of `button[auiMenuTrigger]`. */
@Directive({
  selector: 'button[auiThreadListItemMoreTrigger]',
  standalone: true,
  hostDirectives: [AuiMenuTriggerDirective],
})
export class AuiThreadListItemMoreTriggerDirective {}

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
