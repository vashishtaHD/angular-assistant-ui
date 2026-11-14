// Ported from packages/vue/src/primitives/viewportContext.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { InjectionToken, inject, type Signal } from '@angular/core';
import type { ThreadViewportAutoScroll } from '@assistant-ui/store/client';

/**
 * What an `AuiThreadViewportDirective` provides to its subtree: whether the
 * viewport is pinned to the bottom and the scroll-to-bottom channel.
 */
export interface AuiViewport {
  /** True while the viewport sits at the bottom of its content. */
  isAtBottom: Signal<boolean>;
  /** Scrolls the viewport to the bottom. */
  scrollToBottom(behavior?: ScrollBehavior): void;
  /**
   * Subscribes to explicit `scrollToBottom()` calls (not to the viewport's own
   * run-start or thread-switch scrolling). Returns an unsubscribe function.
   */
  onScrollToBottom(callback: (config: { behavior: ScrollBehavior }) => void): () => void;
  /** Reserves extra space at the end of the content (e.g. a footer). */
  registerContentInset: ThreadViewportAutoScroll['registerContentInset'];
}

/** Injection token for the nearest thread viewport's {@link AuiViewport}. */
export const AUI_VIEWPORT = new InjectionToken<AuiViewport>('assistant-ui.angular.viewport');

/**
 * Returns the nearest thread viewport. Throws when there is none; use
 * `inject(AUI_VIEWPORT, { optional: true })` to tolerate its absence. Must be
 * called in an injection context.
 */
export function injectAuiViewport(): AuiViewport {
  return inject(AUI_VIEWPORT);
}
