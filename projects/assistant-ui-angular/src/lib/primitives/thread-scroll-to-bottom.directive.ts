// Ported from packages/vue/src/primitives/ThreadPrimitiveScrollToBottom.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, booleanAttribute, inject, input, isDevMode } from '@angular/core';
import { AuiActionButtonHostDirective, injectActionButton } from './action-button';
import { AUI_VIEWPORT } from './viewport-context';

let warnedOutsideViewport = false;

/**
 * A button that scrolls the surrounding `[auiThreadViewport]` to the bottom.
 * Disabled while the viewport is already at the bottom, when the consumer sets
 * `disabled`, or when no viewport provides the scroll channel.
 *
 * @example
 * ```html
 * <button auiThreadScrollToBottom behavior="smooth">Jump to latest</button>
 * ```
 */
@Directive({
  selector: 'button[auiThreadScrollToBottom]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiThreadScrollToBottomDirective {
  /** How the scroll animates. */
  readonly behavior = input<ScrollBehavior>('auto');
  /** Consumer-controlled disabled flag, combined with the viewport state. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    const viewport = inject(AUI_VIEWPORT, { optional: true });
    if (isDevMode() && !viewport && !warnedOutsideViewport) {
      warnedOutsideViewport = true;
      console.warn(
        'auiThreadScrollToBottom: no surrounding [auiThreadViewport] provides the scroll channel; the button stays disabled. Place it inside the viewport.',
      );
    }
    injectActionButton({
      disabled: () => this.disabled() || !viewport || viewport.isAtBottom(),
      onClick: () => viewport?.scrollToBottom(this.behavior()),
    });
  }
}
