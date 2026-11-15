// Original (no upstream counterpart): spec helper for author stylesheets.
import { onTestFinished } from 'vitest';

/**
 * Installs a `.flex { display: flex }` author stylesheet for the current test
 * (removed when it finishes). A class rule like this beats the UA
 * `[hidden] { display: none }` rule, so it shows whether a "hidden" surface is
 * really hidden (Task 10 review m6, ruling R21).
 */
export function useFlexAuthorClass(): void {
  const style = document.createElement('style');
  style.textContent = '.flex { display: flex; }';
  document.head.append(style);
  onTestFinished(() => style.remove());
}

/** The computed `display` of `el`. */
export function displayOf(el: Element): string {
  return getComputedStyle(el).display;
}
