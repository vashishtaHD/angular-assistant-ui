// Ported from packages/react/src/primitives/selectionToolbar/SelectionToolbarRoot.tsx @ 7d74276
import { DestroyRef, Directive, computed, inject, input, signal } from '@angular/core';
import { getSelectionMessageId } from './get-selection-message-id';

/** Selection captured by `[auiSelectionToolbarRoot]`. */
export interface SelectionToolbarInfo {
  /** The trimmed selected text. */
  readonly text: string;
  /** The id of the message that contains the whole selection. */
  readonly messageId: string;
  /** The bounding rect of the selection, in viewport coordinates. */
  readonly rect: DOMRect;
}

/**
 * A floating toolbar that is visible while a text selection lies inside a
 * single message. It listens for browser selection changes, validates the
 * selection against `data-message-id` (set by `[auiMessageRoot]`), and
 * exposes the result as signals. It is hidden otherwise, and a mousedown on
 * it does not clear the selection.
 *
 * Positioning is the consumer's: bind to `rect()` (viewport coordinates of the
 * selection), for example `[style.top.px]="toolbar.rect()!.top - 8"`.
 *
 * @example
 * ```html
 * <div auiSelectionToolbarRoot #toolbar="auiSelectionToolbarRoot" class="floating">
 *   <button auiSelectionToolbarQuote>Quote</button>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiSelectionToolbarRoot]',
  standalone: true,
  exportAs: 'auiSelectionToolbarRoot',
  host: {
    '[hidden]': '!info()',
    '(mousedown)': '$event.preventDefault()',
  },
})
export class AuiSelectionToolbarRootDirective {
  /**
   * Restricts the selection to messages inside this element (typically the
   * thread root). Without it, any `[data-message-id]` in the document counts.
   */
  readonly threadRoot = input<Element | null | undefined>(undefined);

  private readonly state = signal<SelectionToolbarInfo | null>(null);
  /** The captured selection, or `null` while the toolbar is hidden. */
  readonly info = this.state.asReadonly();
  /** The selection's bounding rect, or `null` while the toolbar is hidden. */
  readonly rect = computed(() => this.state()?.rect ?? null);

  constructor() {
    let pendingFrame: number | null = null;
    let isMouseDragging = false;

    const cancelFrame = () => {
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      pendingFrame = null;
    };

    // Read the selection on the next frame so the browser has settled it.
    const checkSelection = () => {
      cancelFrame();
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return this.state.set(null);
        const text = sel.toString().trim();
        if (!text) return this.state.set(null);
        const messageId = getSelectionMessageId(sel, this.threadRoot());
        if (!messageId) return this.state.set(null);
        this.state.set({ text, messageId, rect: sel.getRangeAt(0).getBoundingClientRect() });
      });
    };

    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        cancelFrame();
        this.state.set(null);
        return;
      }
      if (!isMouseDragging) checkSelection();
    };
    const onScroll = () => {
      cancelFrame();
      this.state.set(null);
    };
    const onMouseDown = () => (isMouseDragging = true);
    const onMouseUp = () => {
      isMouseDragging = false;
      checkSelection();
    };
    const onMouseCancel = () => (isMouseDragging = false);
    const onWindowBlur = () => {
      if (isMouseDragging) onMouseUp();
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('dragend', onMouseUp, true);
    // A context menu can consume the mouseup of the press that opened it.
    document.addEventListener('contextmenu', onMouseCancel, true);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('scroll', onScroll, true);

    inject(DestroyRef).onDestroy(() => {
      cancelFrame();
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('dragend', onMouseUp, true);
      document.removeEventListener('contextmenu', onMouseCancel, true);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('scroll', onScroll, true);
    });
  }
}
