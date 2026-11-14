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
} from '@angular/core';
import {
  UI_MENU_HOST,
  UiMenuContentDirective,
  UiMenuItemDirective,
  type UiMenuHost,
} from './headless-menu';

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
 * Keyboard: ArrowDown/ArrowUp on the trigger open the menu on the first/last item.
 * Closes on Escape, item selection, Tab and outside click.
 */
@Directive({
  selector: '[auiDropdownMenuTrigger]',
  standalone: true,
  exportAs: 'auiDropdownMenuTrigger',
  host: {
    class: 'aui-dropdown-menu-trigger',
    'aria-haspopup': 'menu',
    '[attr.aria-expanded]': 'isOpen()',
    '[attr.data-state]': 'isOpen() ? "open" : "closed"',
    '(click)': 'toggle()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class AuiDropdownMenuTriggerDirective {
  private readonly overlay = inject(Overlay);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);

  /** The menu template to open. */
  readonly template = input.required<TemplateRef<unknown>>({ alias: 'auiDropdownMenuTrigger' });
  /** Which edge of the trigger the menu lines up with. */
  readonly align = input<AuiDropdownMenuAlign>('start');

  /** Whether the menu is open. */
  readonly isOpen = signal(false);

  private overlayRef: OverlayRef | null = null;
  private content: UiMenuContentDirective | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  /** Opens the menu when closed, closes it when open. */
  toggle(): void {
    if (this.isOpen()) this.close(false);
    else this.open('first');
  }

  /** Opens the menu and focuses its first or last item. */
  open(focus: 'first' | 'last' = 'first'): void {
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
    this.overlayRef = ref;

    const host: UiMenuHost = {
      close: (restoreFocus) => this.close(restoreFocus),
      registerContent: (content) => (this.content = content),
    };
    const injector = Injector.create({
      providers: [{ provide: UI_MENU_HOST, useValue: host }],
      parent: this.injector,
    });
    const view = ref.attach(
      new TemplatePortal(this.template(), this.viewContainerRef, undefined, injector),
    );
    view.detectChanges();
    ref.updatePosition();
    this.isOpen.set(true);
    if (focus === 'last') this.content?.focusLast();
    else this.content?.focusFirst();
  }

  /** Closes the menu; `restoreFocus` returns focus to the trigger. */
  close(restoreFocus: boolean): void {
    if (!this.overlayRef) return;
    this.teardown();
    if (restoreFocus) this.element.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.isOpen()) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.open('last');
    }
  }

  private teardown(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.content = null;
    this.isOpen.set(false);
  }
}

/** Menu surface (`role="menu"`) rendered inside the trigger's template. */
@Directive({
  selector: '[auiDropdownMenuContent]',
  standalone: true,
  hostDirectives: [UiMenuContentDirective],
  host: { class: 'aui-dropdown-menu-content' },
})
export class AuiDropdownMenuContentDirective {}

/**
 * Menu item (`role="menuitem"`). `itemSelect` fires on click, Enter and Space,
 * then the menu closes. `disabled` items are skipped by arrow keys.
 */
@Directive({
  selector: '[auiDropdownMenuItem]',
  standalone: true,
  hostDirectives: [
    { directive: UiMenuItemDirective, inputs: ['disabled'], outputs: ['itemSelect'] },
  ],
  host: { class: 'aui-dropdown-menu-item' },
})
export class AuiDropdownMenuItemDirective {}

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
  host: { class: 'aui-dropdown-menu-separator', role: 'separator' },
})
export class AuiDropdownMenuSeparatorDirective {}
