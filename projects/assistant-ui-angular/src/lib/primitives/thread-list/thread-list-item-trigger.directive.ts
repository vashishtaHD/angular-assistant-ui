// Ported from packages/react/src/primitives/threadListItem/ThreadListItemTrigger.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (and packages/vue/src/primitives/ThreadListItemPrimitiveTrigger.ts)
import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
} from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';
import { injectThreadListCollection, injectThreadListItemFocus } from './thread-list-focus-group';

/**
 * A button that switches to the current thread list item's thread. Carries
 * `data-active` and `aria-current` while that thread is the main one. Inside
 * an `[auiThreadListRoot]` it joins the focus group: only one trigger is in
 * the Tab order (`tabindex="0"`), the others have `tabindex="-1"`.
 */
@Directive({
  selector: 'button[auiThreadListItemTrigger]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
  host: {
    '[attr.data-active]': "active() ? 'true' : null",
    '[attr.aria-current]': "active() ? 'true' : null",
    '[attr.tabindex]': 'tabindex()',
    '(focus)': 'onFocus()',
  },
})
export class AuiThreadListItemTriggerDirective {
  private readonly aui = injectAui();
  private readonly element = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
  private readonly collection = injectThreadListCollection();
  private readonly focus = injectThreadListItemFocus();

  /** True while this item is the main thread. */
  protected readonly active = injectAuiState((s) => s.threads.mainThreadId === s.threadListItem.id);

  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.threadListItem.switchTo(),
    });
    let unregister: (() => void) | undefined;
    afterNextRender(() => {
      unregister = this.collection?.register(this.element);
      this.focus?.trigger.set(this.element);
    });
    inject(DestroyRef).onDestroy(() => {
      unregister?.();
      if (this.focus?.trigger() === this.element) this.focus.trigger.set(null);
    });
  }

  /** @internal */
  protected tabindex(): string | null {
    if (!this.collection) return null;
    return this.collection.isTabStop(this.element) ? '0' : '-1';
  }

  /** @internal */
  protected onFocus(): void {
    this.collection?.setFocused(this.element);
  }
}
