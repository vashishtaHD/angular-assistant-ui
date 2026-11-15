// Ported from packages/react/src/unstable/useComposerInputHistory.ts @ 7d74276
import type { ThreadMessage } from '@assistant-ui/core';
import { getThreadMessageText } from '@assistant-ui/core/internal';
import { flushTapSync } from '@assistant-ui/tap';
import { injectAui } from '../state/inject-aui';
import { injectAuiEvent } from '../state/inject-aui-event';

/**
 * The handler returned by {@link injectComposerInputHistory}; bind it to the
 * input's `keydown`.
 * @experimental Mirrors React's `Unstable_ComposerInputHistory`.
 */
export interface ComposerInputHistory {
  /** Keydown handler for `[auiComposerInput]`: `(keydown)="history.onKeyDown($event)"`. */
  onKeyDown(event: KeyboardEvent): void;
}

interface BrowseState {
  cursor: number;
  draftSnapshot: string;
  lastRecalledText: string;
}

const deriveHistory = (messages: readonly ThreadMessage[]): string[] => {
  const entries: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!;
    if (message.role !== 'user') continue;
    const text = getThreadMessageText(message).trim();
    if (!text) continue;
    if (entries[entries.length - 1] === text) continue;
    entries.push(text);
  }
  return entries;
};

const isOnFirstLine = (value: string, caret: number): boolean =>
  !value.slice(0, caret).includes('\n');
const isOnLastLine = (value: string, caret: number): boolean => !value.slice(caret).includes('\n');

/**
 * Terminal-style input history for the thread composer: ArrowUp on an empty
 * draft recalls previously sent user messages (newest first); ArrowDown steps
 * back toward the newest and finally restores the draft. Recall only triggers
 * with the caret on the first/last line and no selection. Yields to IME
 * composition, modifier keys and handlers that already called
 * `preventDefault`. Inert on edit composers. Must be called in an injection
 * context.
 * @experimental
 *
 * @example
 * ```html
 * <textarea auiComposerInput (keydown)="history.onKeyDown($event)"></textarea>
 * ```
 */
export function injectComposerInputHistory(): ComposerInputHistory {
  const aui = injectAui();
  let browse: BrowseState | null = null;

  injectAuiEvent('threads.selectionChanged', () => {
    browse = null;
  });

  return {
    onKeyDown(e) {
      if (e.defaultPrevented) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (e.isComposing) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (aui.composer.getState().type !== 'thread') return;

      const textarea = e.currentTarget as HTMLTextAreaElement;
      const { selectionStart, selectionEnd, value } = textarea;
      if (selectionStart !== selectionEnd) return;

      if (browse && value !== browse.lastRecalledText) browse = null;
      const current = browse;

      const commitText = (text: string): void => {
        flushTapSync(() => aui.composer.setText(text, { origin: 'recall' }));
        // The value binding re-applies after the commit and moves the caret.
        requestAnimationFrame(() => textarea.setSelectionRange(text.length, text.length));
        e.preventDefault();
      };
      const recall = (history: readonly string[], cursor: number, draftSnapshot: string): void => {
        const entry = history[cursor];
        if (entry === undefined) {
          e.preventDefault();
          return;
        }
        browse = { cursor, draftSnapshot, lastRecalledText: entry };
        commitText(entry);
      };

      if (e.key === 'ArrowUp') {
        if (!isOnFirstLine(value, selectionStart)) return;
        const history = deriveHistory(aui.thread.getState().messages);
        if (!current) {
          if (value.trim() !== '' || history.length === 0) return;
          recall(history, 0, value);
          return;
        }
        const next = current.cursor + 1;
        if (next >= history.length) {
          e.preventDefault();
          return;
        }
        recall(history, next, current.draftSnapshot);
        return;
      }

      if (!current) return;
      if (!isOnLastLine(value, selectionEnd)) return;
      const next = current.cursor - 1;
      if (next < 0) {
        browse = null;
        commitText(current.draftSnapshot);
        return;
      }
      recall(deriveHistory(aui.thread.getState().messages), next, current.draftSnapshot);
    },
  };
}
