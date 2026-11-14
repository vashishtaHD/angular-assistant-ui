// Ported from packages/vue/src/primitives/ThreadPrimitiveViewportFooter.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { AUI_VIEWPORT } from './viewport-context';

/**
 * A footer container that measures its height into the surrounding viewport's
 * content inset. Positions within the summed inset of the native bottom count
 * as at bottom, and a growing inset re-follows a pinned viewport. Multiple
 * footers sum. Typically used with `class="sticky bottom-0"`. Does nothing
 * outside an `[auiThreadViewport]`.
 *
 * @example
 * ```html
 * <div auiThreadViewport>
 *   <aui-thread-messages>…</aui-thread-messages>
 *   <div auiThreadViewportFooter class="sticky bottom-0">…</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiThreadViewportFooter]',
  standalone: true,
})
export class AuiThreadViewportFooterDirective {
  private readonly viewport = inject(AUI_VIEWPORT, { optional: true });

  constructor() {
    const viewport = this.viewport;
    const div = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let dispose: (() => void) | undefined;
    let destroyed = false;

    afterNextRender(() => {
      if (destroyed || !viewport) return;
      const contentInset = viewport.registerContentInset();
      const updateHeight = () => {
        const marginTop = Number.parseFloat(getComputedStyle(div).marginTop) || 0;
        contentInset.setHeight(div.offsetHeight + marginTop);
      };
      updateHeight();

      const resizeObserver =
        typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateHeight);
      resizeObserver?.observe(div);

      dispose = () => {
        resizeObserver?.disconnect();
        contentInset.unregister();
      };
    });

    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      dispose?.();
    });
  }
}
