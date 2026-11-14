// Ported from packages/vue/src/useScrollLock.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { DestroyRef, assertInInjectionContext, inject, type ElementRef } from '@angular/core';

const findScrollableAncestor = (element: HTMLElement | null | undefined): HTMLElement | null => {
  let current = element;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === 'scroll' || overflowY === 'auto') return current;
    current = current.parentElement;
  }
  return null;
};

interface ScrollLock {
  count: number;
  restore: () => void;
}

const scrollLocks = new WeakMap<HTMLElement, ScrollLock>();

const acquireScrollLock = (scrollContainer: HTMLElement): ScrollLock => {
  const existing = scrollLocks.get(scrollContainer);
  if (existing) {
    existing.count++;
    return existing;
  }

  const scrollPosition = scrollContainer.scrollTop;
  const scrollbarWidth = scrollContainer.style.scrollbarWidth;
  const computed = getComputedStyle(scrollContainer);
  const paddingSide = computed.direction === 'rtl' ? 'paddingLeft' : 'paddingRight';
  const previousPadding = scrollContainer.style[paddingSide];
  const elementScrollbarSize =
    scrollContainer.offsetWidth -
    scrollContainer.clientWidth -
    (parseFloat(computed.borderLeftWidth) || 0) -
    (parseFloat(computed.borderRightWidth) || 0);
  // The root's offsetWidth excludes the viewport scrollbar, so use the
  // viewport width only when the element's own gutter is absent.
  const ownerDocument = scrollContainer.ownerDocument;
  const isRootScroller =
    scrollContainer === ownerDocument.documentElement || scrollContainer === ownerDocument.body;
  const scrollbarSize =
    isRootScroller && elementScrollbarSize <= 0
      ? (ownerDocument.defaultView?.innerWidth ?? 0) - ownerDocument.documentElement.clientWidth
      : elementScrollbarSize;

  scrollContainer.style.scrollbarWidth = 'none';
  if (scrollbarSize > 0) {
    scrollContainer.style[paddingSide] =
      `${(parseFloat(computed[paddingSide]) || 0) + scrollbarSize}px`;
  }

  const resetPosition = () => {
    scrollContainer.scrollTop = scrollPosition;
  };
  scrollContainer.addEventListener('scroll', resetPosition);

  const lock: ScrollLock = {
    count: 1,
    restore: () => {
      scrollContainer.removeEventListener('scroll', resetPosition);
      scrollContainer.style.scrollbarWidth = scrollbarWidth;
      scrollContainer.style[paddingSide] = previousPadding;
    },
  };
  scrollLocks.set(scrollContainer, lock);
  return lock;
};

/**
 * Returns a function that freezes the scroll position of the element's
 * nearest scrollable ancestor (hiding its scrollbar without shifting layout)
 * for `durationMs`, then releases it. Locks on the same container are
 * ref-counted: the container is restored when the last lock is released.
 * Calling the function again before it expires replaces the previous lock
 * from the same caller. Any lock still held is released when the calling
 * injection context is destroyed. Must be called in an injection context.
 *
 * @example
 * ```ts
 * private readonly lock = injectScrollLock(inject(ElementRef), 200);
 * toggle() { this.lock(); this.open.update((v) => !v); }
 * ```
 */
export function injectScrollLock(
  elementRef: ElementRef<HTMLElement>,
  durationMs: number,
): () => void {
  assertInInjectionContext(injectScrollLock);
  let cleanup: (() => void) | null = null;

  inject(DestroyRef).onDestroy(() => cleanup?.());

  return () => {
    cleanup?.();

    const scrollContainer = findScrollableAncestor(elementRef.nativeElement);
    if (!scrollContainer) {
      cleanup = null;
      return;
    }

    const lock = acquireScrollLock(scrollContainer);
    const timeoutId = setTimeout(() => cleanup?.(), durationMs);

    cleanup = () => {
      clearTimeout(timeoutId);
      if (--lock.count === 0) {
        lock.restore();
        scrollLocks.delete(scrollContainer);
      }
      cleanup = null;
    };
  };
}
