// Ported from packages/ui/src/components/react/assistant-ui/elements/threadlist-sidebar.aui.tsx @ 7d74276
// (shadcn's Sidebar: a fixed column that becomes an off-canvas drawer below 768px)
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
  signal,
  viewChild,
  type OnChanges,
  type OnInit,
} from '@angular/core';
import { AuiButtonDirective } from './button.directive';
import { AuiIconComponent } from './icons/icon.component';
import { AuiThreadListComponent } from './thread-list/thread-list.component';

let nextSidebarId = 0;

/**
 * An app layout with `aui-thread-list` in a sidebar beside the projected main
 * area. Below `breakpoint` (768px by default) the sidebar becomes a drawer
 * over the main area, opened by the toggle button in the main area's header
 * and closed by that button, the backdrop, Escape or choosing a thread; the
 * closed drawer gets an inline `display: none`.
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
  imports: [AuiThreadListComponent, AuiButtonDirective, AuiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'aui-root aui-thread-list-sidebar',
    '[attr.data-mobile]': 'mobile() ? "" : null',
    '[attr.data-open]': 'drawerOpen() ? "" : null',
  },
  template: `<aside
      #sidebar
      class="aui-sidebar"
      data-slot="aui_sidebar"
      tabindex="-1"
      [id]="sidebarId"
      [attr.role]="drawerOpen() ? 'dialog' : null"
      [attr.aria-modal]="drawerOpen() ? 'true' : null"
      aria-label="Threads"
      [style.display]="mobile() && !open() ? 'none' : null"
      (keydown)="onKeydown($event)"
    >
      <div class="aui-sidebar-header"><ng-content select="[auiSidebarHeader]" /></div>
      <div class="aui-sidebar-content">
        <aui-thread-list (threadSelect)="onThreadSelect()" />
      </div>
      <div class="aui-sidebar-footer"><ng-content select="[auiSidebarFooter]" /></div>
    </aside>
    @if (drawerOpen()) {
      <div class="aui-sidebar-backdrop" aria-hidden="true" (click)="close()"></div>
    }
    <div class="aui-sidebar-main">
      <div class="aui-sidebar-main-header" [style.display]="mobile() ? null : 'none'">
        <button
          #toggle
          auiButton
          variant="ghost"
          size="icon"
          class="aui-sidebar-toggle"
          data-slot="aui_sidebar-toggle"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="sidebarId"
          [attr.aria-label]="open() ? 'Close sidebar' : 'Open sidebar'"
          [style.display]="mobile() ? null : 'none'"
          (click)="open() ? close() : openDrawer()"
        >
          <aui-icon name="panel-left" />
        </button>
      </div>
      <div class="aui-sidebar-main-content"><ng-content /></div>
    </div>`,
})
export class AuiThreadListSidebarComponent implements OnInit, OnChanges {
  /** Widths below this (in px) collapse the sidebar into a drawer. */
  readonly breakpoint = input(768);

  /** @internal */
  protected readonly sidebarId = `aui-sidebar-${++nextSidebarId}`;
  /** @internal True below the breakpoint. */
  protected readonly mobile = signal(false);
  /** @internal Whether the drawer is open (only meaningful below the breakpoint). */
  protected readonly open = signal(false);
  /** @internal */
  protected readonly drawerOpen = computed(() => this.mobile() && this.open());

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

  /** Opens the drawer (below the breakpoint) and moves focus into it. */
  openDrawer(): void {
    this.open.set(true);
    if (!this.mobile()) return;
    this.cdr.detectChanges();
    this.sidebar().nativeElement.focus();
  }

  /** Closes the drawer and returns focus to the toggle. */
  close(): void {
    if (!this.open()) return;
    const wasDrawer = this.drawerOpen();
    this.open.set(false);
    if (!wasDrawer) return;
    this.cdr.detectChanges();
    this.toggle().nativeElement.focus();
  }

  /** @internal */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented || !this.drawerOpen()) return;
    event.preventDefault();
    this.close();
  }

  /** @internal */
  protected onThreadSelect(): void {
    if (this.drawerOpen()) this.close();
  }

  private watch(breakpoint: number): void {
    this.stopWatching?.();
    this.stopWatching = undefined;
    this.watchedBreakpoint = breakpoint;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`);
    const update = (matches: boolean) => {
      this.mobile.set(matches);
      if (!matches) this.open.set(false);
    };
    update(query.matches);
    const listener = (event: MediaQueryListEvent) => update(event.matches);
    query.addEventListener('change', listener);
    this.stopWatching = () => query.removeEventListener('change', listener);
  }
}
