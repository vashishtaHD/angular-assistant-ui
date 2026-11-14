// Ported from packages/react/src/primitives/actionBarMore/*.tsx @ 7d74276
import { Directive, inject } from '@angular/core';
import { AuiMenuContentDirective } from './menu/menu-content.directive';
import { AuiMenuItemDirective } from './menu/menu-item.directive';
import { AuiMenuRootDirective } from './menu/menu-root.directive';
import { AuiMenuSeparatorDirective } from './menu/menu-separator.directive';
import { AuiMenuTriggerDirective } from './menu/menu-trigger.directive';

/**
 * Root of the action bar's "more" menu. A thin alias of `[auiMenuRoot]`
 * (inputs `open` / `openChange`).
 *
 * @example
 * ```html
 * <div auiActionBarMoreRoot>
 *   <button auiActionBarMoreTrigger>…</button>
 *   <div auiActionBarMoreContent>
 *     <button auiActionBarMoreItem (select)="copy()">Copy</button>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiActionBarMoreRoot]',
  standalone: true,
  exportAs: 'auiActionBarMoreRoot',
  hostDirectives: [{ directive: AuiMenuRootDirective, inputs: ['open'], outputs: ['openChange'] }],
})
export class AuiActionBarMoreRootDirective {
  /** The underlying headless menu root. */
  readonly menu = inject(AuiMenuRootDirective);
}

/** Trigger of the action bar's "more" menu. An alias of `button[auiMenuTrigger]`. */
@Directive({
  selector: 'button[auiActionBarMoreTrigger]',
  standalone: true,
  hostDirectives: [AuiMenuTriggerDirective],
})
export class AuiActionBarMoreTriggerDirective {}

/** Popup of the action bar's "more" menu. An alias of `[auiMenuContent]`. */
@Directive({
  selector: '[auiActionBarMoreContent]',
  standalone: true,
  hostDirectives: [AuiMenuContentDirective],
})
export class AuiActionBarMoreContentDirective {}

/**
 * Item of the action bar's "more" menu. An alias of `[auiMenuItem]` (inputs
 * `disabled`, `closeOnSelect`; output `select`).
 */
@Directive({
  selector: '[auiActionBarMoreItem]',
  standalone: true,
  hostDirectives: [
    {
      directive: AuiMenuItemDirective,
      inputs: ['disabled', 'closeOnSelect'],
      outputs: ['select'],
    },
  ],
})
export class AuiActionBarMoreItemDirective {}

/** Separator of the action bar's "more" menu. An alias of `[auiMenuSeparator]`. */
@Directive({
  selector: '[auiActionBarMoreSeparator]',
  standalone: true,
  hostDirectives: [AuiMenuSeparatorDirective],
})
export class AuiActionBarMoreSeparatorDirective {}
