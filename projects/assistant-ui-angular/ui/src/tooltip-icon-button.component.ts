import {
  ConnectedPosition,
  Overlay,
  OverlayRef,
  type PositionStrategy,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AuiButtonDirective } from './button.directive';

/** Side of the button the tooltip appears on. */
export type AuiTooltipSide = 'top' | 'bottom' | 'left' | 'right';

const OFFSET = 6;

const POSITIONS: Record<AuiTooltipSide, ConnectedPosition> = {
  top: {
    originX: 'center',
    originY: 'top',
    overlayX: 'center',
    overlayY: 'bottom',
    offsetY: -OFFSET,
  },
  bottom: {
    originX: 'center',
    originY: 'bottom',
    overlayX: 'center',
    overlayY: 'top',
    offsetY: OFFSET,
  },
  left: {
    originX: 'start',
    originY: 'center',
    overlayX: 'end',
    overlayY: 'center',
    offsetX: -OFFSET,
  },
  right: {
    originX: 'end',
    originY: 'center',
    overlayX: 'start',
    overlayY: 'center',
    offsetX: OFFSET,
  },
};

const OPPOSITE: Record<AuiTooltipSide, AuiTooltipSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

let nextId = 0;

/** Tooltip bubble rendered into the CDK overlay by `aui-tooltip-icon-button`. */
@Component({
  selector: 'aui-tooltip-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'aui-tooltip',
    role: 'tooltip',
    '[id]': 'tooltipId()',
    '[attr.data-side]': 'side()',
  },
  template: `{{ text() }}`,
})
export class AuiTooltipPanelComponent {
  /** Tooltip text. */
  readonly text = input('');
  /** Element id, referenced by `aria-describedby`. */
  readonly tooltipId = input('');
  /** Side the bubble is placed on. */
  readonly side = input<AuiTooltipSide>('bottom');
}

/**
 * Ghost icon button with a tooltip. The tooltip shows on hover and keyboard
 * focus and hides on leave, blur and Escape. Project an `<aui-icon>` as content.
 * Native `click` events from the inner button bubble to the host element.
 */
@Component({
  selector: 'aui-tooltip-icon-button',
  standalone: true,
  imports: [AuiButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-tooltip-icon-button' },
  template: `<button
    #button
    auiButton
    variant="ghost"
    size="icon"
    class="aui-tooltip-icon-button-trigger"
    [attr.aria-label]="ariaLabel() ?? tooltip()"
    [attr.aria-describedby]="describedBy()"
    [disabled]="disabled()"
    (mouseenter)="hovered = true; show()"
    (mouseleave)="hovered = false; syncVisibility()"
    (focus)="focused = true; show()"
    (blur)="focused = false; syncVisibility()"
    (keydown.escape)="hide()"
  >
    <ng-content />
  </button>`,
})
export class AuiTooltipIconButtonComponent {
  private readonly overlay = inject(Overlay);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  /** Tooltip text; also the accessible name unless `ariaLabel` is set. */
  readonly tooltip = input.required<string>();
  /** Side of the button the tooltip appears on. */
  readonly side = input<AuiTooltipSide>('bottom');
  /** Accessible name override. */
  readonly ariaLabel = input<string | null>(null);
  /** Disables the inner button. */
  readonly disabled = input(false);

  protected hovered = false;
  protected focused = false;
  protected readonly describedBy = signal<string | null>(null);

  private overlayRef: OverlayRef | null = null;
  private readonly id = `aui-tooltip-${nextId++}`;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  /** Shows the tooltip. */
  protected show(): void {
    if (this.overlayRef || this.disabled()) return;
    const side = this.side();
    const ref = this.overlay.create({
      positionStrategy: this.positionFor(side),
      scrollStrategy: this.overlay.scrollStrategies.close(),
      panelClass: 'aui-tooltip-pane',
    });
    const panel = ref.attach(new ComponentPortal(AuiTooltipPanelComponent));
    panel.setInput('text', this.tooltip());
    panel.setInput('tooltipId', this.id);
    panel.setInput('side', side);
    ref.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.hide();
    });
    this.overlayRef = ref;
    this.describedBy.set(this.id);
  }

  /** Hides the tooltip and clears hover/focus tracking. */
  protected hide(): void {
    this.hovered = false;
    this.focused = false;
    this.dispose();
  }

  /** Hides the tooltip when neither hover nor focus remains. */
  protected syncVisibility(): void {
    if (!this.hovered && !this.focused) this.dispose();
  }

  private dispose(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.describedBy.set(null);
  }

  private positionFor(side: AuiTooltipSide): PositionStrategy {
    const opposite = POSITIONS[OPPOSITE[side]];
    return this.overlay
      .position()
      .flexibleConnectedTo(this.button())
      .withPositions([POSITIONS[side], opposite])
      .withPush(false);
  }
}
