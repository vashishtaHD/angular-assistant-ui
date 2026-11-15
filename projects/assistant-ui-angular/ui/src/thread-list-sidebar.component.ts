// Ported from packages/ui/src/components/react/assistant-ui/elements/threadlist-sidebar.aui.tsx @ 7d74276
// (shadcn's Sidebar: a collapsible column with a rail and Ctrl/Cmd+B, which becomes
// an off-canvas Sheet drawer below 768px)
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
  type OnChanges,
  type OnInit,
} from '@angular/core';
import { AuiButtonDirective } from './button.directive';
import { AuiIconComponent } from './icons/icon.component';
import { AuiThreadListComponent } from './thread-list/thread-list.component';

let nextSidebarId = 0;

/** Whether `aui-thread-list-sidebar` can collapse on wide screens. */
export type AuiSidebarCollapsible = 'offcanvas' | 'none';

/**
 * An app layout with `aui-thread-list` in a sidebar beside the projected main
 * area.
 *
 * On wide screens the sidebar is a column that collapses and expands from the
 * toggle button in the main area's header, the rail on the sidebar's edge or
 * Ctrl/Cmd+B (two-way bind `collapsed` to control or persist it). Below
 * `breakpoint` (768px by default) it becomes a modal drawer over the main
 * area: opened by the toggle or Ctrl/Cmd+B, it traps focus, makes the main
 * area `inert`, and closes from its close button, the backdrop, Escape or
 * choosing a thread. A hidden sidebar gets `hidden` and an inline
 * `display: none`.
 *
 * Project an `[auiSidebarHeader]` and an `[auiSidebarFooter]` element for the
 * sidebar's header and footer (upstream shows its branding there); anything
 * else is the main area. Give the component a height. Use it inside an
 * `[auiProvider]` with a thread list runtime.
 *
 * @example
 * ```html
 * <aui-thread-list-sidebar style="height: 100dvh">
 *   <span auiSidebarHeader>My app</span>
 *   <aui-thread />
 * </aui-thread-list-sidebar>
 * ```
 */
@Component({
  selector: 'aui-thread-list-sidebar',
  standalone: true,
  imports: [AuiThreadListComponent, AuiButtonDirective, AuiIconComponent, CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'aui-root aui-thread-list-sidebar',
    '[attr.data-mobile]': 'mobile() ? "" : null',
    '[attr.data-open]': 'drawerOpen() ? "" : null',
    '[attr.data-collapsed]': 'canCollapse() && collapsed() ? "" : null',
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  template: `<aside
      #sidebar
      class="aui-sidebar"
      data-slot="aui_sidebar"
      tabindex="-1"
      [id]="sidebarId"
      [cdkTrapFocus]="drawerOpen()"
      [attr.role]="drawerOpen() ? 'dialog' : null"
      [attr.aria-modal]="drawerOpen() ? 'true' : null"
      aria-label="Threads"
      [hidden]="!expanded()"
      [style.display]="expanded() ? null : 'none'"
    >
      @if (drawerOpen()) {
        <button
          auiButton
          variant="ghost"
          size="icon"
          class="aui-sidebar-close"
          data-slot="aui_sidebar-close"
          aria-label="Close sidebar"
          (click)="close()"
        >
          <aui-icon name="x" />
        </button>
      }
      <div class="aui-sidebar-header"><ng-content select="[auiSidebarHeader]" /></div>
      <div class="aui-sidebar-content">
        <aui-thread-list (threadSelect)="onThreadSelect()" />
      </div>
      <div class="aui-sidebar-footer"><ng-content select="[auiSidebarFooter]" /></div>
    </aside>
    @if (canCollapse()) {
      <button
        type="button"
        class="aui-sidebar-rail"
        data-slot="aui_sidebar-rail"
        tabindex="-1"
        aria-label="Toggle Sidebar"
        title="Toggle Sidebar"
        (click)="toggleSidebar()"
      ></button>
    }
    @if (drawerOpen()) {
      <div class="aui-sidebar-backdrop" aria-hidden="true" (click)="close()"></div>
    }
    <div class="aui-sidebar-main" [attr.inert]="drawerOpen() ? '' : null">
      <div
        class="aui-sidebar-main-header"
        [style.display]="mobile() || canCollapse() ? null : 'none'"
      >
        <button
          #toggle
          auiButton
          variant="ghost"
          size="icon"
          class="aui-sidebar-toggle"
          data-slot="aui_sidebar-toggle"
          [attr.aria-expanded]="expanded()"
          [attr.aria-controls]="sidebarId"
          [attr.aria-label]="expanded() ? 'Close sidebar' : 'Open sidebar'"
          (click)="toggleSidebar()"
        >
          <aui-icon name="panel-left" />
        </button>
      </div>
      <div class="aui-sidebar-main-content"><ng-content /></div>
    </div>`,
})
export class AuiThreadListSidebarComponent implements OnInit, OnChanges {
  /** Widths below this (in px) turn the sidebar into a drawer. */
  readonly breakpoint = input(768);
  /** Whether the wide-screen sidebar is collapsed. Supports `[(collapsed)]`. */
  readonly collapsed = model(false);
  /**
   * `'offcanvas'` (the default) lets the sidebar collapse on wide screens and
   * become a drawer below the breakpoint; `'none'` keeps it a static, always
   * shown column at every width, without the rail, toggle or drawer, like
   * upstream's `collapsible="none"`.
   */
  readonly collapsible = input<AuiSidebarCollapsible>('offcanvas');

  /** @internal */
  protected readonly sidebarId = `aui-sidebar-${++nextSidebarId}`;
  /** @internal True below the breakpoint. */
  private readonly narrow = signal(false);
  /**
   * @internal True when the sidebar acts as a drawer: below the breakpoint, unless
   * `collapsible` is `'none'` (upstream renders that static column at every width).
   */
  protected readonly mobile = computed(() => this.narrow() && this.collapsible() !== 'none');
  /** @internal Whether the drawer is open (only meaningful below the breakpoint). */
  protected readonly open = signal(false);
  /** @internal */
  protected readonly drawerOpen = computed(() => this.mobile() && this.open());
  /** @internal Whether the sidebar is shown at the current width. */
  protected readonly expanded = computed(() =>
    this.mobile() ? this.open() : !(this.canCollapse() && this.collapsed()),
  );
  /** @internal Whether the wide-screen sidebar can collapse right now. */
  protected readonly canCollapse = computed(() => !this.mobile() && this.collapsible() !== 'none');

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sidebar = viewChild.required<ElementRef<HTMLElement>>('sidebar');
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  private stopWatching: (() => void) | undefined;
  private watchedBreakpoint: number | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopWatching?.());
  }

  /** @internal Starts (or restarts) watching the viewport once the breakpoint input is set. */
  ngOnInit(): void {
    this.watch(this.breakpoint());
  }

  /** @internal */
  ngOnChanges(): void {
    if (this.watchedBreakpoint !== undefined && this.watchedBreakpoint !== this.breakpoint()) {
      this.watch(this.breakpoint());
    }
  }

  /**
   * Toggles the sidebar like upstream's `toggleSidebar`: the drawer below the
   * breakpoint, the collapsed state above it.
   */
  toggleSidebar(): void {
    if (this.mobile()) {
      if (this.open()) this.close();
      else this.openDrawer();
    } else if (this.canCollapse()) {
      this.collapsed.update((collapsed) => !collapsed);
    }
  }

  /** Shows the sidebar: opens the drawer (and moves focus into it) or expands the column. */
  openDrawer(): void {
    if (!this.mobile()) {
      this.collapsed.set(false);
      return;
    }
    this.open.set(true);
    this.cdr.detectChanges();
    this.sidebar().nativeElement.focus();
  }

  /** Closes the drawer and returns focus to the toggle. Does nothing on wide screens. */
  close(): void {
    if (!this.drawerOpen()) return;
    this.open.set(false);
    // Render first so the main area is no longer inert when the toggle takes focus.
    this.cdr.detectChanges();
    this.toggle().nativeElement.focus();
  }

  /** @internal Escape closes the drawer wherever focus is; Ctrl/Cmd+B toggles. */
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && this.drawerOpen()) {
      event.preventDefault();
      this.close();
    } else if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.toggleSidebar();
    }
  }

  /** @internal */
  protected onThreadSelect(): void {
    this.close();
  }

  private watch(breakpoint: number): void {
    this.stopWatching?.();
    this.stopWatching = undefined;
    this.watchedBreakpoint = breakpoint;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`);
    const update = (matches: boolean) => {
      this.narrow.set(matches);
      if (!matches) this.open.set(false);
    };
    update(query.matches);
    const listener = (event: MediaQueryListEvent) => update(event.matches);
    query.addEventListener('change', listener);
    this.stopWatching = () => query.removeEventListener('change', listener);
  }
}
