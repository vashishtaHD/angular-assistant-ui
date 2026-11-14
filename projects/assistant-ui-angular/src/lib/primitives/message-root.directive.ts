// Ported from packages/vue/src/primitives/message.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';

/**
 * Marks the wrapper element of one message. Sets `data-message-id` and
 * `data-role`, and tracks pointer hover into `s.message.isHovering`,
 * including an element already under the pointer when it renders. Hover is
 * reset when the element is destroyed.
 *
 * @example
 * ```html
 * <div auiMessageRoot class="message">…</div>
 * ```
 */
@Directive({
  selector: '[auiMessageRoot]',
  standalone: true,
  host: {
    '[attr.data-message-id]': 'messageId()',
    '[attr.data-role]': 'role()',
    '(mouseenter)': 'onMouseenter()',
    '(mouseleave)': 'onMouseleave()',
  },
})
export class AuiMessageRootDirective {
  private readonly aui = injectAui();
  /** The scoped message's id. */
  protected readonly messageId = injectAuiState((s) => s.message.id);
  /** The scoped message's role. */
  protected readonly role = injectAuiState((s) => s.message.role);
  private active = true;

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (this.active && el.matches(':hover')) this.onMouseenter();
    });
    inject(DestroyRef).onDestroy(() => {
      this.active = false;
      this.onMouseleave();
    });
  }

  /** Marks the message as hovered. */
  protected onMouseenter(): void {
    this.aui.message.setIsHovering(true);
  }

  /** Marks the message as not hovered. */
  protected onMouseleave(): void {
    this.aui.message.setIsHovering(false);
  }
}
