// Ported from packages/vue/src/primitives/actionBar.ts @ 7d74276 (defaultCopyToClipboard)
import { InjectionToken } from '@angular/core';

/** Writes text to the clipboard. May be asynchronous; a rejection is swallowed by the Copy button. */
export type AuiClipboardWriter = (text: string) => void | Promise<void>;

/**
 * Injection token for the clipboard writer used by `[auiActionBarCopy]`.
 * Defaults to `navigator.clipboard.writeText`, rejecting when the Clipboard
 * API is unavailable. Provide your own to customise or to mock in tests.
 */
export const AUI_CLIPBOARD = new InjectionToken<AuiClipboardWriter>(
  'assistant-ui.angular.clipboard',
  {
    providedIn: 'root',
    factory: () => (text: string) => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        return Promise.reject(new Error('Clipboard API is not available.'));
      }
      return navigator.clipboard.writeText(text);
    },
  },
);
