// Ported from packages/react/src/primitives/threadListItem/ThreadListItemRoot.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (and packages/vue/src/primitives/ThreadListItemPrimitiveRoot.ts)
import { Directive, ElementRef, inject } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';
import { ThreadListItemFocus, injectThreadListCollection } from './thread-list-focus-group';

/**
 * Marks the wrapper element of one thread list item. Sets `data-active` and
 * `aria-current` while the item is the main thread and `data-archived` while
 * it is archived. Handles arrow-key navigation between the item triggers of
 * the enclosing `[auiThreadListRoot]`: ArrowUp/ArrowDown move to the previous
 * or next enabled trigger (no wrapping), Home/End jump to the first or last,
 * and the inline-forward/back arrow moves between the trigger and the item's
 * "more" button. Keys with a modifier, and events a listener already
 * default-prevented, are left alone.
 *
 * @example
 * ```html
 * <div auiThreadListItemRoot>
 *   <button auiThreadListItemTrigger><aui-thread-list-item-title /></button>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiThreadListItemRoot]',
  standalone: true,
  providers: [ThreadListItemFocus],
  host: {
    '[attr.data-active]': "active() ? 'true' : null",
    '[attr.aria-current]': "active() ? 'true' : null",
    '[attr.data-archived]': "archived() ? 'true' : null",
    '(keydown)': 'onKeydown($event)',
  },
})
export class AuiThreadListItemRootDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly focus = inject(ThreadListItemFocus);
  private readonly collection = injectThreadListCollection();

  /** True while this item is the main thread. */
  protected readonly active = injectAuiState((s) => s.threads.mainThreadId === s.threadListItem.id);
  /** True while this item is archived. */
  protected readonly archived = injectAuiState((s) => s.threadListItem.status === 'archived');

  /** @internal */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const rtl = getComputedStyle(this.element).direction === 'rtl';
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const trigger = this.focus.trigger();
    const more = this.focus.more();

    if (trigger && event.target === trigger) {
      if (event.key === forwardKey && more) {
        more.focus();
        event.preventDefault();
        return;
      }
      const items = this.collection?.getItems();
      if (!items) return;
      let next: HTMLButtonElement | undefined;
      if (event.key === 'ArrowDown') next = items[items.indexOf(trigger) + 1];
      else if (event.key === 'ArrowUp') next = items[items.indexOf(trigger) - 1];
      else if (event.key === 'Home') next = items[0];
      else if (event.key === 'End') next = items[items.length - 1];
      if (next && next !== trigger) {
        next.focus();
        event.preventDefault();
      }
    } else if (more && event.target === more && event.key === backKey) {
      trigger?.focus();
      event.preventDefault();
    }
  }
}
