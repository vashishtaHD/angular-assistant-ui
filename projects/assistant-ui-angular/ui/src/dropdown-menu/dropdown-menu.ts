// Ported from packages/ui/src/components/react/ui/base/dropdown-menu.tsx @ 7d74276
import { Overlay, OverlayRef, type ConnectedPosition } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  inject,
  input,
  signal,
  type Signal,
} from '@angular/core';
import {
  AuiMenuContentDirective,
  AuiMenuItemDirective,
  AuiMenuRootDirective,
  AuiMenuSeparatorDirective,
  AuiMenuTriggerDirective,
} from 'angular-assistant-ui';

/** Horizontal alignment of the menu relative to its trigger. */
export type AuiDropdownMenuAlign = 'start' | 'end';

const GAP = 4;

function positions(align: AuiDropdownMenuAlign): ConnectedPosition[] {
  const x = align === 'start' ? 'start' : 'end';
  return [
    { originX: x, originY: 'bottom', overlayX: x, overlayY: 'top', offsetY: GAP },
    { originX: x, originY: 'top', overlayX: x, overlayY: 'bottom', offsetY: -GAP },
  ];
}

/**
 * Opens a menu template in a CDK overlay below the host element (flipping above
 * when there is no room). Pass the template of the menu:
 *
 * ```html
 * <button auiButton [auiDropdownMenuTrigger]="menu">More</button>
 * <ng-template #menu>
 *   <div auiDropdownMenuContent>
 *     <button auiDropdownMenuItem (itemSelect)="archive()">Archive</button>
 *   </div>
 * </ng-template>
 * ```
 *
 * Built on the main entry's headless menu: the host is an `[auiMenuRoot]` and
 * an `[auiMenuTrigger]`, and the template's content and items are
 * `[auiMenuContent]` and `[auiMenuItem]`. The template is rendered only while
 * the menu is open; it is unmounted on close, never just hidden.
 *
 * Keyboard: ArrowDown/ArrowUp on the trigger open the menu on the first/last
 * item, and a keyboard click (Enter/Space) opens it on the first item. A pointer
 * click opens it with focus on the menu surface (no item highlighted), as Radix
 * does; ArrowDown then enters the list. Closes on Escape, item
 * selection, Tab and outside click.
 */
@Directive({
  selector: '[auiDropdownMenuTrigger]',
  standalone: true,
  exportAs: 'auiDropdownMenuTrigger',
  hostDirectives: [AuiMenuRootDirective, AuiMenuTriggerDirective],
  host: { class: 'aui-dropdown-menu-trigger' },
})
export class AuiDropdownMenuTriggerDirective {
  private readonly overlay = inject(Overlay);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly menu = inject(AuiMenuRootDirective);

  /** The menu template to open. */
  readonly template = input.required<TemplateRef<unknown>>({ alias: 'auiDropdownMenuTrigger' });
  /** Which edge of the trigger the menu lines up with. */
  readonly align = input<AuiDropdownMenuAlign>('start');

  /** Whether the menu is open. A read-only view of the underlying menu root's `open`. */
  readonly isOpen: Signal<boolean> = this.menu.open.asReadonly();

  private overlayRef: OverlayRef | null = null;

  constructor() {
    const stop = this.menu.watchOpenState((open) => (open ? this.attach() : this.teardown()));
    inject(DestroyRef).onDestroy(() => {
      stop();
      this.teardown();
    });
  }

  /** Opens the menu when closed, closes it when open. */
  toggle(): void {
    if (this.isOpen()) this.close(false);
    else this.open('first');
  }

  /** Opens the menu and focuses its first or last item. */
  open(focus: 'first' | 'last' = 'first'): void {
    this.menu.setOpen(true, { focus });
  }

  /** Closes the menu; `restoreFocus` returns focus to the trigger. */
  close(restoreFocus: boolean): void {
    this.menu.setOpen(false, { restoreFocus });
  }

  private attach(): void {
    if (this.overlayRef) return;
    const strategy = this.overlay
      .position()
      .flexibleConnectedTo(this.element)
      .withPositions(positions(this.align()))
      .withPush(false);
    const ref = this.overlay.create({
      positionStrategy: strategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      panelClass: 'aui-dropdown-menu-pane',
    });
    strategy.positionChanges.subscribe((change) => {
      ref.overlayElement.setAttribute(
        'data-side',
        change.connectionPair.overlayY === 'top' ? 'bottom' : 'top',
      );
    });
    ref.backdropClick().subscribe(() => this.close(false));
    // Fallback for Escape while focus is outside the menu.
    ref.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) this.close(true);
    });
    this.overlayRef = ref;

    // The template is declared by the consumer, so hand its view this menu root.
    const injector = Injector.create({
      providers: [{ provide: AuiMenuRootDirective, useValue: this.menu }],
      parent: this.injector,
    });
    const view = ref.attach(
      new TemplatePortal(this.template(), this.viewContainerRef, undefined, injector),
    );
    view.detectChanges();
    ref.updatePosition();
  }

  private teardown(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}

/**
 * Menu surface (`role="menu"`) rendered inside the trigger's template. An
 * `[auiMenuContent]`: roving focus, Home/End, typeahead, Escape and Tab.
 */
@Directive({
  selector: '[auiDropdownMenuContent]',
  standalone: true,
  hostDirectives: [AuiMenuContentDirective],
  host: { class: 'aui-dropdown-menu-content', 'aria-orientation': 'vertical' },
})
export class AuiDropdownMenuContentDirective {}

/**
 * Menu item (`role="menuitem"`), an `[auiMenuItem]`. `itemSelect` fires on
 * click, Enter and Space with the originating event, then the menu closes and
 * focus returns to the trigger; call `event.preventDefault()` in the handler to
 * keep the menu open. `disabled` items are skipped by arrow keys. The focused
 * item carries `data-highlighted` and the roving `tabindex="0"`.
 */
@Directive({
  selector: '[auiDropdownMenuItem]',
  standalone: true,
  hostDirectives: [
    { directive: AuiMenuItemDirective, inputs: ['disabled'], outputs: ['select: itemSelect'] },
  ],
  host: {
    class: 'aui-dropdown-menu-item',
    '[attr.tabindex]': 'highlighted() ? "0" : "-1"',
    '[attr.data-highlighted]': 'highlighted() ? "" : null',
    '(focus)': 'highlighted.set(true)',
    '(blur)': 'highlighted.set(false)',
  },
})
export class AuiDropdownMenuItemDirective {
  /** @internal */
  protected readonly highlighted = signal(false);
}

/** Non-interactive heading inside a menu. */
@Directive({
  selector: '[auiDropdownMenuLabel]',
  standalone: true,
  host: { class: 'aui-dropdown-menu-label' },
})
export class AuiDropdownMenuLabelDirective {}

/** Divider between menu items. */
@Directive({
  selector: '[auiDropdownMenuSeparator]',
  standalone: true,
  hostDirectives: [AuiMenuSeparatorDirective],
  host: { class: 'aui-dropdown-menu-separator' },
})
export class AuiDropdownMenuSeparatorDirective {}
