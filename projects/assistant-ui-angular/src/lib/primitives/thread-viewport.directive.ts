// Ported from packages/vue/src/primitives/ThreadPrimitiveViewport.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
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
import { AUI_VIEWPORT, type AuiViewport } from './viewport-context';

/**
 * A scrollable container that keeps the thread pinned to the bottom: content
 * growth scrolls back down while the user sits at the bottom, a run start
 * scrolls down, and scrolling up unpins until the user returns to the bottom.
 * The four options are independent: `autoScroll` covers follow-on-content-
 * growth, and the other three gate the first-messages, run-start, and
 * thread-switch scrolls. Provides `AUI_VIEWPORT` to its subtree.
 */
@Directive({
  selector: '[auiThreadViewport]',
  standalone: true,
  providers: [
    { provide: AUI_VIEWPORT, useFactory: () => inject(AuiThreadViewportDirective).viewport },
  ],
})
export class AuiThreadViewportDirective implements OnInit, OnChanges {
  /** Follow content growth while pinned to the bottom. */
  readonly autoScroll = input(true, { transform: booleanAttribute });
  /** Scroll to the bottom when the first messages appear. */
  readonly scrollToBottomOnInitialize = input(true, { transform: booleanAttribute });
  /** Scroll to the bottom when a run starts. */
  readonly scrollToBottomOnRunStart = input(true, { transform: booleanAttribute });
  /** Scroll to the bottom when the selected thread changes. */
  readonly scrollToBottomOnThreadSwitch = input(true, { transform: booleanAttribute });

  private readonly isAtBottomState = signal(true);
  private readonly injector = inject(Injector);
  private readonly context = injectAuiContext();
  private readonly scroller = createThreadViewportAutoScroll({
    getOptions: () =>
      untracked(() => ({
        autoScroll: this.autoScroll(),
        scrollToBottomOnInitialize: this.scrollToBottomOnInitialize(),
        scrollToBottomOnRunStart: this.scrollToBottomOnRunStart(),
        scrollToBottomOnThreadSwitch: this.scrollToBottomOnThreadSwitch(),
      })),
    onAtBottomChange: (value) => this.isAtBottomState.set(value),
  });

  private readonly scrollListeners = new Set<(config: { behavior: ScrollBehavior }) => void>();

  /** The value provided as `AUI_VIEWPORT`. */
  readonly viewport: AuiViewport = {
    isAtBottom: this.isAtBottomState.asReadonly(),
    scrollToBottom: (behavior: ScrollBehavior = 'auto') => {
      this.scroller.scrollToBottom(behavior);
      for (const listener of [...this.scrollListeners]) listener({ behavior });
    },
    onScrollToBottom: (callback) => {
      this.scrollListeners.add(callback);
      return () => {
        this.scrollListeners.delete(callback);
      };
    },
    registerContentInset: this.scroller.registerContentInset,
  };

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    let detach: (() => void) | undefined;
    let destroyed = false;
    afterNextRender(
      () => {
        if (!destroyed) detach = this.scroller.attach(element);
      },
      { injector: this.injector },
    );

    // The provider attaches its real client on its first ngOnChanges, so the
    // subscription re-evaluates when the client changes.
    const unsubscribe = this.context.source.subscribe(() => this.syncHasMessages());
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      unsubscribe();
      detach?.();
      this.scroller.dispose();
    });

    injectAuiEvent('thread.runStart', () => this.scroller.runStarted());
    injectAuiEvent('threads.selectionChanged', () => this.scroller.threadSwitched());
  }

  ngOnInit(): void {
    this.syncHasMessages();
  }

  ngOnChanges(): void {
    this.syncHasMessages();
  }

  private syncHasMessages(): void {
    const state = getProxiedAssistantState(this.context.source.getClient());
    // Before the provider attaches its client there is no thread scope yet.
    const messages = state.optional.thread?.messages;
    this.scroller.setHasMessages((messages?.length ?? 0) > 0);
  }
}
