// Ported from packages/ui/src/components/react/assistant-ui/elements/tooltip-icon-button.tsx @ 7d74276
import {
  ConnectedPosition,
  Overlay,
  OverlayRef,
  type FlexibleConnectedPositionStrategy,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  ViewEncapsulation,
  inject,
  input,
  signal,
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
 * Adds a tooltip to any element, typically a headless primitive button styled
 * with `button[auiButton]` (`<button auiButton auiActionBarCopy auiTooltip="Copy">`).
 * The tooltip shows on hover and keyboard focus, hides on leave, blur and
 * Escape, and is linked through `aria-describedby` while shown. It does not
 * show while the element is `disabled`. It does not set an accessible name:
 * give the element an `aria-label` (or text) of its own.
 */
@Directive({
  selector: '[auiTooltip]',
  standalone: true,
  host: {
    '[attr.aria-describedby]': 'describedBy()',
    '(mouseenter)': 'hovered = true; show()',
    '(mouseleave)': 'hovered = false; syncVisibility()',
    '(focus)': 'focused = true; show()',
    '(blur)': 'focused = false; syncVisibility()',
    '(keydown.escape)': 'hide()',
  },
})
export class AuiTooltipDirective {
  private readonly overlay = inject(Overlay);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Tooltip text. */
  readonly text = input.required<string>({ alias: 'auiTooltip' });
  /** Side of the element the tooltip appears on. */
  readonly side = input<AuiTooltipSide>('bottom', { alias: 'auiTooltipSide' });

  protected hovered = false;
  protected focused = false;
  /** @internal The tooltip id while it is shown. */
  readonly describedBy = signal<string | null>(null);

  private overlayRef: OverlayRef | null = null;
  private readonly id = `aui-tooltip-${nextId++}`;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  /** Shows the tooltip. */
  protected show(): void {
    if (this.overlayRef || (this.element as HTMLButtonElement).disabled === true) return;
    const side = this.side();
    const strategy = this.positionFor(side);
    const ref = this.overlay.create({
      positionStrategy: strategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
      panelClass: 'aui-tooltip-pane',
    });
    const panel = ref.attach(new ComponentPortal(AuiTooltipPanelComponent));
    panel.setInput('text', this.text());
    panel.setInput('tooltipId', this.id);
    panel.setInput('side', side);
    strategy.positionChanges.subscribe(({ connectionPair }) => {
      const landed = (Object.keys(POSITIONS) as AuiTooltipSide[]).find(
        (s) =>
          POSITIONS[s].originX === connectionPair.originX &&
          POSITIONS[s].originY === connectionPair.originY,
      );
      if (landed) panel.setInput('side', landed);
    });
    ref.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.hide();
    });
    // Scroll dismissal (and any other external detach) must reset our state too.
    ref.detachments().subscribe(() => {
      if (this.overlayRef === ref) this.dispose();
    });
    this.overlayRef = ref;
    ref.updatePosition();
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
    const ref = this.overlayRef;
    this.overlayRef = null;
    ref?.dispose();
    this.describedBy.set(null);
  }

  private positionFor(side: AuiTooltipSide): FlexibleConnectedPositionStrategy {
    const opposite = POSITIONS[OPPOSITE[side]];
    return this.overlay
      .position()
      .flexibleConnectedTo(this.element)
      .withPositions([POSITIONS[side], opposite])
      .withPush(false);
  }
}

/**
 * Ghost icon button with a tooltip. The tooltip shows on hover and keyboard
 * focus and hides on leave, blur and Escape. Project an `<aui-icon>` as content.
 * Native `click` events from the inner button bubble to the host element.
 * To put a tooltip on a headless primitive button, use `[auiTooltip]` instead.
 */
@Component({
  selector: 'aui-tooltip-icon-button',
  standalone: true,
  imports: [AuiButtonDirective, AuiTooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-tooltip-icon-button' },
  template: `<button
    auiButton
    variant="ghost"
    size="icon"
    class="aui-tooltip-icon-button-trigger"
    [auiTooltip]="tooltip()"
    [auiTooltipSide]="side()"
    [attr.aria-label]="ariaLabel() ?? tooltip()"
    [disabled]="disabled()"
  >
    <ng-content />
  </button>`,
})
export class AuiTooltipIconButtonComponent {
  /** Tooltip text; also the accessible name unless `ariaLabel` is set. */
  readonly tooltip = input.required<string>();
  /** Side of the button the tooltip appears on. */
  readonly side = input<AuiTooltipSide>('bottom');
  /** Accessible name override. */
  readonly ariaLabel = input<string | null>(null);
  /** Disables the inner button. */
  readonly disabled = input(false);
}
