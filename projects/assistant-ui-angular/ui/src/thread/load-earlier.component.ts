// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadLoadEarlier) @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  inject,
} from '@angular/core';
import { AuiThreadLoadEarlierDirective, injectAuiState } from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';

const FOCUSABLE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']):not([disabled])";

/** The first focusable element after `start` in document order, within its following siblings. */
const nextFocusable = (start: Element): HTMLElement | null => {
  for (let element = start.nextElementSibling; element; element = element.nextElementSibling) {
    const target = element.matches(FOCUSABLE_SELECTOR)
      ? element
      : element.querySelector(FOCUSABLE_SELECTOR);
    if (target instanceof HTMLElement) return target;
  }
  return null;
};

/**
 * Tells the owning `aui-thread-load-earlier` when its button is removed.
 * @internal
 */
@Directive({
  selector: '[auiThreadLoadEarlierRemoval]',
  standalone: true,
})
export class AuiThreadLoadEarlierRemovalDirective {
  constructor() {
    const owner = inject(AuiThreadLoadEarlierComponent);
    inject(DestroyRef).onDestroy(() => owner.buttonRemoved());
  }
}

/**
 * The Load earlier messages button at the top of a thread with earlier
 * history, plus a live region announcing the load. When the last page removes
 * the focused button, focus continues at the next control in tab order
 * rather than falling back to the document body.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-load-earlier',
  standalone: true,
  imports: [
    AuiThreadLoadEarlierDirective,
    AuiButtonDirective,
    AuiThreadLoadEarlierRemovalDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents', '(focusin)': 'focused = $event.target' },
  template: `<span role="status" class="aui-sr-only">{{
      loading() ? 'Loading earlier messages' : ''
    }}</span>
    @if (visible()) {
      <button
        auiButton
        variant="ghost"
        size="sm"
        auiThreadLoadEarlier
        auiThreadLoadEarlierRemoval
        class="aui-thread-load-earlier"
        data-slot="aui_thread-load-earlier"
      >
        <span [class.aui-shimmer]="loading()">{{
          loading() ? 'Loading earlier messages' : 'Load earlier messages'
        }}</span>
      </button>
    }`,
})
export class AuiThreadLoadEarlierComponent {
  /** @internal */
  protected readonly visible = injectAuiState(
    (s) => s.thread.hasEarlier || s.thread.isLoadingEarlier,
  );
  /** @internal */
  protected readonly loading = injectAuiState((s) => s.thread.isLoadingEarlier);
  /** @internal The last element focused inside this slot. */
  protected focused: EventTarget | null = null;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  /**
   * @internal The button left the DOM. Once rendering settles, if it held
   * focus and nothing else took it, move focus to the next control.
   */
  buttonRemoved(): void {
    if (this.destroyed) return;
    afterNextRender(
      () => {
        const focused = this.focused;
        this.focused = null;
        if (this.destroyed || !(focused instanceof Element) || focused.isConnected) return;
        const active = document.activeElement;
        if (active && active !== document.body) return;
        nextFocusable(this.host)?.focus();
      },
      { injector: this.injector },
    );
  }
}
