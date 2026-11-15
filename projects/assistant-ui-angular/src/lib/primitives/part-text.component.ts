// Ported from packages/react/src/primitives/messagePart/MessagePartText.tsx @ 7d74276
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { injectSmoothState, type SmoothOptions } from '../utils/smooth';
import { injectMessagePartText } from './part-state';

/**
 * Renders the text of the current text or reasoning part, revealed with a
 * typewriter-style animation while the part streams. Sets `data-status` to
 * the status the animation reports: `running` until the reveal has caught up
 * with the streamed text, then the part's own status. Inline by default.
 *
 * The reveal is off under `prefers-reduced-motion: reduce`, which wins over
 * `smooth`. Use inside a part scope (for example in an `auiPart="text"`
 * template of `aui-message-parts`).
 *
 * @example
 * ```html
 * <aui-part-text />
 * <aui-part-text [smooth]="{ drainMs: 500 }" />
 * <aui-part-text [smooth]="false" />
 * ```
 */
@Component({
  selector: 'aui-part-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-status]': 'smoothed().status.type' },
  template: `{{ smoothed().text }}`,
})
export class AuiPartTextComponent {
  /**
   * `true` (default) reveals the text smoothly, `false` shows it as it
   * arrives, and {@link SmoothOptions} tunes the reveal.
   */
  readonly smooth = input<boolean | SmoothOptions>(true);

  private readonly part = injectMessagePartText();
  private readonly text = computed(() => this.part().text);
  private readonly status = computed(() => this.part().status);
  /** The revealed text and the status to report. */
  protected readonly smoothed = injectSmoothState(this.text, this.status, this.smooth);
}
