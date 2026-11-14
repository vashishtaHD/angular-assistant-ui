// Ported from packages/vue/src/primitives/ThreadPrimitiveViewport.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (turnAnchor / topAnchorMessageClamp from packages/react/src/primitives/thread/ThreadViewport.tsx)
import type {} from '@assistant-ui/core/store';
import {
  DestroyRef,
  Injector,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  signal,
  untracked,
  type OnChanges,
  type OnInit,
} from '@angular/core';
import {
  createThreadViewportAutoScroll,
  getProxiedAssistantState,
} from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';
import { injectAuiEvent } from '../state/inject-aui-event';
import {
  getActiveTopAnchorTurn,
  isTopAnchorTurnValid,
  mountTopAnchorReserve,
  parseCssLength,
  type TopAnchorStore,
  type TopAnchorTurn,
} from '../utils/top-anchor';
import { AUI_VIEWPORT, type AuiViewport } from './viewport-context';

/** Optional-boolean input transform: unset stays `undefined`, attributes coerce. */
const optionalBoolean = (value: boolean | string | null | undefined): boolean | undefined =>
  value === undefined || value === null ? undefined : booleanAttribute(value);

/** Clamp for tall anchored user messages (CSS lengths in `px`, `em` or `rem`). */
export interface AuiTopAnchorMessageClamp {
  /** Clamp messages taller than this. Default `"10em"`. */
  tallerThan?: string;
  /** Visible portion of a clamped message. Default `"6em"`. */
  visibleHeight?: string;
}

/**
 * A scrollable container that keeps the thread pinned to the bottom: content
 * growth scrolls back down while the user sits at the bottom, a run start
 * scrolls down, and scrolling up unpins until the user returns to the bottom.
 * The four options are independent: `autoScroll` covers follow-on-content-
 * growth, and the other three gate the first-messages, run-start, and
 * thread-switch scrolls. Provides `AUI_VIEWPORT` to its subtree.
 *
 * With `turnAnchor="top"` a run start pins the new user message to the top of
 * the viewport (a spacer after the reply makes that scrollable) instead of
 * following the bottom; `autoScroll` then defaults to off. `turnAnchor` and
 * `topAnchorMessageClamp` are read once, when the viewport attaches. Messages
 * are found through the `data-message-id` that `[auiMessageRoot]` sets.
 */
@Directive({
  selector: '[auiThreadViewport]',
  standalone: true,
  providers: [
    { provide: AUI_VIEWPORT, useFactory: () => inject(AuiThreadViewportDirective).viewport },
  ],
})
export class AuiThreadViewportDirective implements OnInit, OnChanges {
  /**
   * Follow content growth while pinned to the bottom. Defaults to `true`, or
   * to `false` when `turnAnchor` is `"top"`.
   */
  readonly autoScroll = input<boolean | undefined, boolean | string | null | undefined>(undefined, {
    transform: optionalBoolean,
  });
  /**
   * `"bottom"` (default) is classic chat behavior; `"top"` anchors the latest
   * user message at the top of the viewport when a run starts.
   */
  readonly turnAnchor = input<'top' | 'bottom'>('bottom');
  /** Clamps tall anchored user messages so the reply stays in view. */
  readonly topAnchorMessageClamp = input<AuiTopAnchorMessageClamp | undefined>(undefined);
  /** Scroll to the bottom when the first messages appear. */
  readonly scrollToBottomOnInitialize = input(true, { transform: booleanAttribute });
  /** Scroll to the bottom when a run starts. Ignored when `turnAnchor` is `"top"`. */
  readonly scrollToBottomOnRunStart = input(true, { transform: booleanAttribute });
  /** Scroll to the bottom when the selected thread changes. */
  readonly scrollToBottomOnThreadSwitch = input(true, { transform: booleanAttribute });

  private readonly isAtBottomState = signal(true);
  private readonly injector = inject(Injector);
  private readonly context = injectAuiContext();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private destroyed = false;
  private detachScroller: (() => void) | undefined;
  private disposeTopAnchor: (() => void) | undefined;
  /** `turnAnchor` and the clamp as bound at init: both are initial-only (as upstream). */
  private snapshot:
    { turnAnchor: 'top' | 'bottom'; clamp: AuiTopAnchorMessageClamp | undefined } | undefined;
  private marked: { anchor: HTMLElement | null; target: HTMLElement | null } = {
    anchor: null,
    target: null,
  };
  private topAnchorTurn: TopAnchorTurn | null = null;
  private readonly topAnchorListeners = new Set<() => void>();
  private previousFirst: {
    threadId: string | undefined;
    firstMessageId: string | undefined;
  } | null = null;
  private readonly scroller = createThreadViewportAutoScroll({
    getOptions: () =>
      untracked(() => {
        const top = this.config().turnAnchor === 'top';
        return {
          autoScroll: this.autoScroll() ?? !top,
          holdFollow: top && this.isRunning() && this.findAnchorElements().anchor !== null,
          scrollToBottomOnInitialize: this.scrollToBottomOnInitialize(),
          scrollToBottomOnRunStart: this.scrollToBottomOnRunStart() && !top,
          scrollToBottomOnThreadSwitch: this.scrollToBottomOnThreadSwitch(),
        };
      }),
    onAtBottomChange: (value) => this.isAtBottomState.set(value),
  });

  /** The value provided as `AUI_VIEWPORT`. */
  readonly viewport: AuiViewport = {
    isAtBottom: this.isAtBottomState.asReadonly(),
    scrollToBottom: (behavior: ScrollBehavior = 'auto') => this.scroller.scrollToBottom(behavior),
    registerContentInset: this.scroller.registerContentInset,
  };

  constructor() {
    const element = this.element;

    afterNextRender(
      () => {
        if (this.destroyed) return;
        this.detachScroller = this.scroller.attach(element);
        this.mountTopAnchor();
      },
      { injector: this.injector },
    );

    // The provider attaches its real client on its first ngOnChanges, so the
    // subscription re-evaluates when the client changes.
    const unsubscribe = this.context.source.subscribe(() => {
      this.syncHasMessages();
      this.syncTopAnchorTurn();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      unsubscribe();
      this.disposeTopAnchor?.();
      this.markElements(null, null);
      this.detachScroller?.();
      this.scroller.dispose();
    });

    injectAuiEvent('thread.runStart', () => this.scroller.runStarted());
    injectAuiEvent('threads.selectionChanged', () => this.scroller.threadSwitched());
  }

  ngOnInit(): void {
    // The first moment the initial bindings are in place (the first render
    // hook can run before them), so this is where the config is frozen.
    this.snapshot = {
      turnAnchor: untracked(() => this.turnAnchor()),
      clamp: untracked(() => this.topAnchorMessageClamp()),
    };
    this.syncHasMessages();
    this.syncTopAnchorTurn();
    this.mountTopAnchor();
  }

  ngOnChanges(): void {
    this.syncHasMessages();
  }

  /** The frozen initial config, or the live bindings before it is frozen. */
  private config(): { turnAnchor: 'top' | 'bottom'; clamp: AuiTopAnchorMessageClamp | undefined } {
    return (
      this.snapshot ?? {
        turnAnchor: untracked(() => this.turnAnchor()),
        clamp: untracked(() => this.topAnchorMessageClamp()),
      }
    );
  }

  /** Mounts the top-anchor reserve once, when attached with `turnAnchor="top"`. */
  private mountTopAnchor(): void {
    if (this.disposeTopAnchor || this.destroyed || !this.detachScroller || !this.snapshot) return;
    if (this.snapshot.turnAnchor !== 'top') return;
    const dispose = mountTopAnchorReserve(this.topAnchorStore());
    this.disposeTopAnchor = () => {
      dispose();
      this.markElements(null, null);
    };
  }

  /** Sets `data-aui-top-anchor-user` / `-target` on the eligible elements only. */
  private markElements(anchor: HTMLElement | null, target: HTMLElement | null): void {
    const previous = this.marked;
    if (previous.anchor !== anchor) {
      previous.anchor?.removeAttribute('data-aui-top-anchor-user');
      anchor?.setAttribute('data-aui-top-anchor-user', '');
    }
    if (previous.target !== target) {
      previous.target?.removeAttribute('data-aui-top-anchor-target');
      target?.setAttribute('data-aui-top-anchor-target', '');
    }
    this.marked = { anchor, target };
  }

  private syncHasMessages(): void {
    const state = getProxiedAssistantState(this.context.source.getClient());
    // Before the provider attaches its client there is no thread scope yet.
    const messages = state.optional.thread?.messages;
    this.scroller.setHasMessages((messages?.length ?? 0) > 0);

    // Earlier messages prepended to the same thread keep the scroll position.
    const threadId = state.optional.threadListItem?.id;
    const firstMessageId = messages?.[0]?.id;
    const previous = this.previousFirst;
    this.previousFirst = { threadId, firstMessageId };
    if (
      previous &&
      previous.threadId === threadId &&
      previous.firstMessageId !== undefined &&
      previous.firstMessageId !== firstMessageId &&
      messages?.some((message, index) => index > 0 && message.id === previous.firstMessageId)
    ) {
      this.scroller.messagesPrepended(previous.firstMessageId);
    }
  }

  private isRunning(): boolean {
    const state = getProxiedAssistantState(this.context.source.getClient());
    return state.optional.thread?.isRunning ?? false;
  }

  /** Tracks the live user/assistant pair; drops it once it stops being the trailing turn. */
  private syncTopAnchorTurn(): void {
    if (this.config().turnAnchor !== 'top') return;
    const thread = getProxiedAssistantState(this.context.source.getClient()).optional.thread;
    if (!thread) return;
    const messages = thread.messages;
    if (this.topAnchorTurn && !isTopAnchorTurnValid(this.topAnchorTurn, messages)) {
      this.topAnchorTurn = null;
    }
    const active = getActiveTopAnchorTurn({ isRunning: thread.isRunning, messages });
    if (
      active &&
      (this.topAnchorTurn?.anchorId !== active.anchorId ||
        this.topAnchorTurn.targetId !== active.targetId)
    ) {
      this.topAnchorTurn = active;
    }
    for (const listener of this.topAnchorListeners) listener();
  }

  /**
   * The anchor (previous user message) and target (streaming reply) elements.
   * Eligibility is upstream's, per element: the anchor is the second-to-last
   * message, a user message that is not the first message, followed by an
   * assistant message; the target is the last message, an assistant reply to a
   * user message. Each also needs a running thread or to be the stored turn.
   */
  private findAnchorElements(): { anchor: HTMLElement | null; target: HTMLElement | null } {
    const thread = getProxiedAssistantState(this.context.source.getClient()).optional.thread;
    const messages = thread?.messages ?? [];
    const last = messages.at(-1);
    const prev = messages.at(-2);
    const running = thread?.isRunning ?? false;
    const turn = this.topAnchorTurn;
    const isAnchor =
      prev?.role === 'user' &&
      messages.length - 2 > 0 &&
      last?.role === 'assistant' &&
      (prev.id === turn?.anchorId || running);
    const isTarget =
      last?.role === 'assistant' &&
      messages.length - 1 >= 1 &&
      prev?.role === 'user' &&
      (last.id === turn?.targetId || running);
    const byId = (id: string) =>
      Array.from(this.element.querySelectorAll<HTMLElement>('[data-message-id]')).find(
        (el) => el.dataset['messageId'] === id,
      ) ?? null;
    return {
      anchor: isAnchor ? byId(prev.id) : null,
      target: isTarget ? byId(last.id) : null,
    };
  }

  private topAnchorStore(): TopAnchorStore {
    const viewport = this.element;
    // Newly rendered message elements arrive after the store change.
    const observer = new MutationObserver(() => {
      for (const listener of this.topAnchorListeners) listener();
    });
    observer.observe(viewport, { childList: true, subtree: true });
    return {
      getState: () => {
        const { anchor, target } = this.findAnchorElements();
        const clamp = this.config().clamp;
        this.markElements(anchor, target);
        return {
          turnAnchor: 'top' as const,
          element: { viewport, anchor, target },
          targetConfig: target
            ? {
                tallerThan: parseCssLength(clamp?.tallerThan ?? '10em', target),
                visibleHeight: parseCssLength(clamp?.visibleHeight ?? '6em', target),
              }
            : null,
          topAnchorTurn: this.topAnchorTurn,
        };
      },
      subscribe: (fn) => {
        this.topAnchorListeners.add(fn);
        return () => {
          this.topAnchorListeners.delete(fn);
          observer.disconnect();
        };
      },
    };
  }
}
