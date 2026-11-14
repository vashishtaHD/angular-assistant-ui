// Ported from packages/react/src/primitives/actionBarMore/*.tsx @ 7d74276
import { DestroyRef, Directive, inject } from '@angular/core';
import { AUI_ACTION_BAR_INTERACTION } from './action-bar/action-bar-root.directive';
import { AuiMenuContentDirective } from './menu/menu-content.directive';
import { AuiMenuItemDirective } from './menu/menu-item.directive';
import { AuiMenuRootDirective } from './menu/menu-root.directive';
import { AuiMenuSeparatorDirective } from './menu/menu-separator.directive';
import { AuiMenuTriggerDirective } from './menu/menu-trigger.directive';

/**
 * Root of the action bar's "more" menu. A thin alias of `[auiMenuRoot]`
 * (inputs `open` / `openChange`).
 *
 * Inside an `[auiActionBarRoot]` it holds the bar's interaction lock while the
 * menu is open, so an `autohide` bar stays visible after the pointer leaves
 * the message or focus leaves the bar. The lock follows the menu's actual open
 * state (user interaction or the `open` binding) and is released when the
 * menu closes or is destroyed.
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
  private readonly interaction = inject(AUI_ACTION_BAR_INTERACTION, { optional: true });
  private releaseLock: (() => void) | null = null;

  constructor() {
    const stop = this.menu.watchOpenState((open) => this.setLocked(open));
    inject(DestroyRef).onDestroy(() => {
      stop();
      this.setLocked(false);
    });
  }

  private setLocked(locked: boolean): void {
    if (locked) {
      this.releaseLock ??= this.interaction?.acquireInteractionLock() ?? null;
      return;
    }
    this.releaseLock?.();
    this.releaseLock = null;
  }
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
