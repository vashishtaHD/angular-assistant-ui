// Ported from packages/react/src/primitives/actionBarMore/ActionBarMoreRoot.tsx @ 7d74276
import {
  Directive,
  Injector,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  model,
  type OnChanges,
  type SimpleChanges,
} from '@angular/core';
import type { AuiMenuContentDirective } from './menu-content.directive';

let nextMenuId = 0;

/** Which element receives focus when the menu opens. */
export type AuiMenuInitialFocus = 'content' | 'first' | 'last';

/** Options of {@link AuiMenuRootDirective.setOpen}. */
export interface AuiMenuSetOpenOptions {
  /** Where focus goes after opening. Defaults to `'content'`. */
  readonly focus?: AuiMenuInitialFocus;
  /** Move focus back to the trigger after closing. Defaults to `false`. */
  readonly restoreFocus?: boolean;
}

/**
 * Root of a headless WAI-ARIA menu (no CDK, no positioning). It owns the
 * `open` state shared by `button[auiMenuTrigger]`, `[auiMenuContent]`,
 * `[auiMenuItem]` and `[auiMenuSeparator]`, which find it through
 * dependency injection.
 *
 * The content stays in the DOM and is hidden with the `hidden` attribute (plus
 * a host `display: none` style binding that class-based CSS cannot override)
 * while closed; wrap it in `@if (menu.open())` (or
 * render it in an overlay, as the `ui` entry's dropdown menu does) when the
 * markup should not exist. Pointer-down outside the trigger and the content
 * closes the menu. Supports `[(open)]` two-way binding.
 *
 * The menu is always non-modal; there is no `modal` option. Upstream's
 * Radix-based dropdown defaults to modal (it blocks pointer events and
 * scrolling outside and hides the rest of the page from assistive technology
 * while open); this menu leaves the page interactive, does not lock scrolling
 * and does not trap focus. Add those in the caller (for example an overlay
 * with a backdrop) when a modal menu is needed.
 *
 * @example
 * ```html
 * <div auiMenuRoot #menu="auiMenuRoot">
 *   <button auiMenuTrigger>More</button>
 *   <div auiMenuContent>
 *     <button auiMenuItem (select)="rename()">Rename</button>
 *     <hr auiMenuSeparator />
 *     <button auiMenuItem (select)="remove()">Delete</button>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiMenuRoot]',
  standalone: true,
  exportAs: 'auiMenuRoot',
  host: {
    '[attr.data-state]': 'open() ? "open" : "closed"',
    '(document:pointerdown)': 'onDocumentPointerdown($event)',
  },
})
export class AuiMenuRootDirective implements OnChanges {
  private readonly injector = inject(Injector);

  /** Whether the menu is open. Two-way bindable. */
  readonly open = model(false);
  /**
   * Enables side-arrow navigation for menus that live in a horizontal focus
   * group: the trigger opens on ArrowRight (ArrowLeft in RTL) and the content
   * closes and refocuses the trigger on the opposite arrow.
   */
  readonly sideKeys = input(false, { transform: booleanAttribute });

  /** Stable id of the content element. */
  readonly contentId = `aui-menu-${++nextMenuId}`;

  /** @internal Registered by `button[auiMenuTrigger]`. */
  trigger: HTMLElement | null = null;
  /** @internal Registered by `[auiMenuContent]`. */
  content: AuiMenuContentDirective | null = null;

  private lastOpen = false;
  /** Where focus goes for the current opening. */
  private focusTarget: AuiMenuInitialFocus = 'content';
  private focusScheduled = false;
  private readonly openListeners = new Set<(open: boolean) => void>();

  /** @internal */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) this.handleOpenState(this.open());
  }

  /**
   * Opens or closes the menu.
   *
   * @param open - The next state.
   * @param options - Focus behaviour; see {@link AuiMenuSetOpenOptions}.
   */
  setOpen(open: boolean, options: AuiMenuSetOpenOptions = {}): void {
    if (open && !this.lastOpen) this.focusTarget = options.focus ?? 'content';
    this.open.set(open);
    this.handleOpenState(open);
    if (!open && options.restoreFocus) this.trigger?.focus();
  }

  /**
   * Toggles the menu.
   *
   * @param options - Focus behaviour; see {@link AuiMenuSetOpenOptions}.
   */
  toggle(options: AuiMenuSetOpenOptions = {}): void {
    this.setOpen(!this.open(), options);
  }

  /**
   * @internal Called by the content when it is created while already open (for
   * example inside `@if (menu.open())` or an overlay): focuses it with the
   * target requested for this opening.
   */
  focusOnCreate(): void {
    if (this.open()) this.scheduleFocus();
  }

  /**
   * @internal Calls `listener` on every open/closed transition, whether it came
   * from a user interaction (`setOpen`) or from the `open` input binding.
   * Returns the function that removes the listener.
   */
  watchOpenState(listener: (open: boolean) => void): () => void {
    this.openListeners.add(listener);
    return () => this.openListeners.delete(listener);
  }

  private handleOpenState(open: boolean): void {
    if (open === this.lastOpen) return;
    this.lastOpen = open;
    if (open) this.scheduleFocus();
    else this.focusTarget = 'content';
    for (const listener of [...this.openListeners]) listener(open);
  }

  /** One pending focus per render: opening and content creation share it. */
  private scheduleFocus(): void {
    if (this.focusScheduled) return;
    this.focusScheduled = true;
    afterNextRender(
      () => {
        this.focusScheduled = false;
        if (this.open()) this.content?.focusInitial(this.focusTarget);
      },
      { injector: this.injector },
    );
  }

  /** @internal */
  onDocumentPointerdown(event: PointerEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && (this.trigger?.contains(target) || this.content?.contains(target))) return;
    this.setOpen(false);
  }
}
