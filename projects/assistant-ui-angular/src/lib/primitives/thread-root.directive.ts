// Ported from packages/vue/src/primitives/thread.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, ElementRef, inject } from '@angular/core';
import { injectAui } from '../state/inject-aui';
import { AUI_THREAD_ROOT_ELEMENT } from './composer-input-support';

/**
 * Returns the nearest `[auiThreadRoot]`'s element, or `undefined` outside one.
 * Must be called in an injection context.
 */
export function injectThreadRootElementRef(): ElementRef<HTMLElement> | undefined {
  return inject(AUI_THREAD_ROOT_ELEMENT, { optional: true }) ?? undefined;
}

/**
 * Marks the wrapper element of the thread. While it exists, Escape stops an
 * active speech synthesis run (unless another handler already called
 * `preventDefault()`).
 *
 * @example
 * ```html
 * <div auiThreadRoot class="thread">…</div>
 * ```
 */
@Directive({
  selector: '[auiThreadRoot]',
  standalone: true,
  providers: [{ provide: AUI_THREAD_ROOT_ELEMENT, useFactory: () => inject(ElementRef) }],
  host: { 'data-aui-thread-root': '', '(document:keydown.escape)': 'onEscape($event)' },
})
export class AuiThreadRootDirective {
  private readonly aui = injectAui();

  /** Stops speaking on an unhandled Escape while a message is spoken. */
  protected onEscape(event: KeyboardEvent): void {
    const aui = this.aui;
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (aui.thread.source === null) return;
    if (aui.thread.getState().speech == null) return;
    event.preventDefault();
    try {
      aui.thread.stopSpeaking();
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'No message is being spoken') {
        throw error;
      }
    }
  }
}
