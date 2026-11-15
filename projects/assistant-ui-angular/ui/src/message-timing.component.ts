// Ported from packages/ui/src/components/react/assistant-ui/elements/message-timing.aui.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
  signal,
} from '@angular/core';
import { injectMessageTiming } from 'angular-assistant-ui';
import type { AuiTooltipSide } from './tooltip-icon-button.component';

let nextTimingId = 0;

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
        type="button"
        class="aui-message-timing-trigger"
        data-slot="message-timing-trigger"
        aria-label="Message timing"
        [attr.aria-describedby]="open() ? popoverId : null"
        (mouseenter)="open.set(true)"
        (mouseleave)="open.set(false)"
        (focus)="open.set(true)"
        (blur)="open.set(false)"
        (keydown.escape)="open.set(false)"
      >
        {{ format(t.totalStreamTime) }}
      </button>
      <div
        role="tooltip"
        class="aui-message-timing-popover"
        data-slot="message-timing-popover"
        [id]="popoverId"
        [attr.data-side]="side()"
        [attr.data-state]="open() ? 'open' : 'closed'"
        [style.display]="open() ? null : 'none'"
      >
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
      </div>
    }
  }`,
})
export class AuiMessageTimingComponent {
  /** Side of the popover relative to the badge. */
  readonly side = input<AuiTooltipSide>('right');

  /** @internal */
  protected readonly timing = injectMessageTiming();
  /** @internal */
  protected readonly open = signal(false);
  /** @internal */
  protected readonly popoverId = `aui-message-timing-${++nextTimingId}`;
  /** @internal */
  protected readonly format = formatTimingMs;
}
