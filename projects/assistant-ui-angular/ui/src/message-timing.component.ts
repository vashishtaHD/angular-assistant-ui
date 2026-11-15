// Ported from packages/ui/src/components/react/assistant-ui/elements/message-timing.aui.tsx @ 7d74276
import { Overlay, type ConnectedPosition, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  ViewEncapsulation,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { injectMessageTiming } from 'angular-assistant-ui';
import type { AuiTooltipSide } from './tooltip-icon-button.component';

let nextTimingId = 0;

/** Gap between the badge and the popover, like upstream's `sideOffset={8}`. */
const OFFSET = 8;

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

/** Preferred side first, then its opposite, then the other axis (Radix flips the same way). */
const FALLBACKS: Record<AuiTooltipSide, AuiTooltipSide[]> = {
  top: ['top', 'bottom', 'right', 'left'],
  bottom: ['bottom', 'top', 'right', 'left'],
  left: ['left', 'right', 'top', 'bottom'],
  right: ['right', 'left', 'top', 'bottom'],
};

/** Formats a duration like upstream: `—` when unknown, `120ms`, or `1.50s`. */
export function formatTimingMs(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Streaming stats of the current assistant message (time to first token,
 * total time, tokens per second, chunks) as a badge showing the total, with
 * a popover on hover and focus. Renders nothing until the stream completes
 * (`metadata.timing.totalStreamTime` is set) and for other roles.
 *
 * The popover renders in the CDK overlay, so scrolling ancestors do not clip
 * it, and flips to another side when `side` runs out of viewport. It is
 * removed from the DOM while closed.
 *
 * Place it inside an assistant message, for example in its action bar so it
 * inherits the bar's autohide.
 *
 * @example
 * ```html
 * <div auiActionBarRoot>… <aui-message-timing side="top" /></div>
 * ```
 */
@Component({
  selector: 'aui-message-timing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-message-timing' },
  template: `@if (timing(); as t) {
      @if (t.totalStreamTime !== undefined) {
        <button
          #trigger
          type="button"
          class="aui-message-timing-trigger"
          data-slot="message-timing-trigger"
          aria-label="Message timing"
          [attr.aria-describedby]="open() ? popoverId : null"
          (mouseenter)="show()"
          (mouseleave)="hide()"
          (focus)="show()"
          (blur)="hide()"
          (keydown.escape)="hide()"
        >
          {{ format(t.totalStreamTime) }}
        </button>
      }
    }
    <ng-template #stats>
      <div
        role="tooltip"
        class="aui-root aui-message-timing-popover"
        data-slot="message-timing-popover"
        [id]="popoverId"
        [attr.data-side]="placedSide()"
        data-state="open"
        [hidden]="!open()"
        [style.display]="open() ? null : 'none'"
      >
        @if (timing(); as t) {
          @if (t.firstTokenTime !== undefined) {
            <div class="aui-message-timing-row">
              <span class="aui-message-timing-label">First token</span>
              <span class="aui-message-timing-value">{{ format(t.firstTokenTime) }}</span>
            </div>
          }
          <div class="aui-message-timing-row">
            <span class="aui-message-timing-label">Total</span>
            <span class="aui-message-timing-value">{{ format(t.totalStreamTime) }}</span>
          </div>
          @if (t.tokensPerSecond !== undefined) {
            <div class="aui-message-timing-row">
              <span class="aui-message-timing-label">Speed</span>
              <span class="aui-message-timing-value">{{ t.tokensPerSecond.toFixed(1) }} tok/s</span>
            </div>
          }
          <div class="aui-message-timing-row">
            <span class="aui-message-timing-label">Chunks</span>
            <span class="aui-message-timing-value">{{ t.totalChunks }}</span>
          </div>
        }
      </div>
    </ng-template>`,
})
export class AuiMessageTimingComponent {
  /** Preferred side of the popover relative to the badge; it flips when out of room. */
  readonly side = input<AuiTooltipSide>('right');

  /** @internal */
  protected readonly timing = injectMessageTiming();
  /** @internal */
  protected readonly open = signal(false);
  /** @internal The side the popover was actually placed on. */
  protected readonly placedSide = signal<AuiTooltipSide>('right');
  /** @internal */
  protected readonly popoverId = `aui-message-timing-${++nextTimingId}`;
  /** @internal */
  protected readonly format = formatTimingMs;

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');
  private readonly stats = viewChild.required<TemplateRef<unknown>>('stats');
  private overlayRef: OverlayRef | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  /** @internal Opens the popover next to the badge. */
  protected show(): void {
    const trigger = this.trigger()?.nativeElement;
    if (this.overlayRef || !trigger) return;
    const sides = FALLBACKS[this.side()];
    const strategy = this.overlay
      .position()
      .flexibleConnectedTo(trigger)
      .withPositions(sides.map((side) => POSITIONS[side]))
      .withViewportMargin(OFFSET)
      .withPush(false);
    const ref = this.overlay.create({
      positionStrategy: strategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'aui-message-timing-pane',
    });
    strategy.positionChanges.subscribe(({ connectionPair }) => {
      const placed = sides.find(
        (side) =>
          POSITIONS[side].originX === connectionPair.originX &&
          POSITIONS[side].originY === connectionPair.originY,
      );
      if (placed && placed !== this.placedSide()) {
        this.placedSide.set(placed);
        this.cdr.detectChanges();
      }
    });
    this.overlayRef = ref;
    this.placedSide.set(sides[0]!);
    this.open.set(true);
    ref.attach(new TemplatePortal(this.stats(), this.viewContainerRef));
    this.cdr.detectChanges();
    ref.updatePosition();
  }

  /** @internal Closes the popover. */
  protected hide(): void {
    this.dispose();
    this.cdr.markForCheck();
  }

  private dispose(): void {
    const ref = this.overlayRef;
    this.overlayRef = null;
    this.open.set(false);
    ref?.dispose();
  }
}
