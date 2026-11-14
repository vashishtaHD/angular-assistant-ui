// Ported from packages/react/src/primitives/threadListFocusGroup.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (also packages/vue/src/primitives/threadListFocusGroup.ts; the Radix Collection becomes a registry of trigger buttons)
import { Injectable, inject, signal } from '@angular/core';

interface Entry {
  trigger: HTMLButtonElement;
  isDisabled: () => boolean;
}

const inDomOrder = (a: HTMLElement, b: HTMLElement): number => {
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
};

/**
 * The registry of the trigger buttons inside one `[auiThreadListRoot]`. It
 * backs arrow-key navigation and the roving `tabindex` (exactly one trigger
 * is reachable with Tab: the last focused one, else the first enabled one).
 * Provided by `AuiThreadListRootDirective`.
 */
@Injectable()
export class ThreadListCollection {
  private readonly entries = signal<readonly Entry[]>([]);
  private readonly focused = signal<HTMLButtonElement | null>(null);

  /**
   * Adds `trigger`; returns the function that removes it. `isDisabled` should
   * read signals so the roving tab stop follows enabled-state changes.
   */
  register(trigger: HTMLButtonElement, isDisabled: () => boolean = () => false): () => void {
    const entry: Entry = { trigger, isDisabled };
    this.entries.update((list) => [...list.filter((e) => e.trigger !== trigger), entry]);
    return () => {
      this.entries.update((list) => list.filter((e) => e !== entry));
      if (this.focused() === trigger) this.focused.set(null);
    };
  }

  /** Remembers `trigger` as the roving tab stop. */
  setFocused(trigger: HTMLButtonElement): void {
    this.focused.set(trigger);
  }

  /** The registered, enabled triggers in document order. */
  getItems(): HTMLButtonElement[] {
    return this.entries()
      .filter((e) => e.trigger.isConnected && !e.isDisabled() && !e.trigger.disabled)
      .map((e) => e.trigger)
      .sort(inDomOrder);
  }

  /** True when `trigger` is the one trigger reachable with Tab. Reactive. */
  isTabStop(trigger: HTMLButtonElement): boolean {
    const focused = this.focused();
    const current = focused && this.entries().find((e) => e.trigger === focused);
    if (current && !current.isDisabled() && !current.trigger.disabled) {
      return focused === trigger;
    }
    return this.getItems()[0] === trigger;
  }
}

/** The enclosing thread list's {@link ThreadListCollection}, or `null` outside one. */
export function injectThreadListCollection(): ThreadListCollection | null {
  return inject(ThreadListCollection, { optional: true });
}

/**
 * The buttons of one thread list item that take part in keyboard navigation.
 * Provided by `AuiThreadListItemRootDirective`. `trigger` is registered by
 * `button[auiThreadListItemTrigger]` and `more` by
 * `button[auiThreadListItemMoreTrigger]`.
 */
@Injectable()
export class ThreadListItemFocus {
  /** The item's trigger button. */
  readonly trigger = signal<HTMLButtonElement | null>(null);
  /** The item's "more" button, if any. */
  readonly more = signal<HTMLButtonElement | null>(null);
}

/** The enclosing thread list item's {@link ThreadListItemFocus}, or `null` outside one. */
export function injectThreadListItemFocus(): ThreadListItemFocus | null {
  return inject(ThreadListItemFocus, { optional: true });
}
