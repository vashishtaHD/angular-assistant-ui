// Ported from packages/ui/src/components/react/assistant-ui/elements/follow-up-suggestions.aui.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import {
  AuiIfDirective,
  AuiSuggestionTriggerDirective,
  injectAuiState,
  type AssistantState,
} from 'angular-assistant-ui';

/**
 * The scrolling row of follow-up suggestions, with edge fades while it
 * overflows.
 * @internal Part of `aui-follow-up-suggestions`.
 */
@Component({
  selector: 'aui-follow-up-suggestions-row',
  standalone: true,
  imports: [AuiSuggestionTriggerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div
    #scroller
    class="aui-thread-followup-suggestions"
    [style.mask-image]="mask()"
    [style.-webkit-mask-image]="mask()"
    (scroll)="updateFades()"
  >
    <div class="aui-thread-followup-suggestions-inner">
      @for (suggestion of suggestions(); track $index) {
        <button
          type="button"
          auiSuggestionTrigger
          send
          class="aui-thread-followup-suggestion"
          [prompt]="suggestion.prompt"
        >
          {{ suggestion.title ?? suggestion.prompt }}
          @if (suggestion.label) {
            <span class="aui-thread-followup-suggestion-label">{{ suggestion.label }}</span>
          }
        </button>
      }
    </div>
  </div>`,
})
export class AuiFollowUpSuggestionsRowComponent {
  /** @internal */
  protected readonly suggestions = injectAuiState((s) => s.thread.suggestions);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly fades = signal({ left: false, right: false });
  private rtl: boolean | null = null;

  /** @internal */
  protected readonly mask = computed(() => {
    const { left, right } = this.fades();
    return `linear-gradient(to right, ${left ? 'transparent, black 2rem' : 'black'}, ${
      right ? 'black calc(100% - 2rem), transparent' : 'black'
    })`;
  });

  constructor() {
    let observer: ResizeObserver | undefined;
    afterNextRender(() => {
      this.updateFades();
      const el = this.scroller().nativeElement;
      if (typeof ResizeObserver === 'undefined' || !el.firstElementChild) return;
      observer = new ResizeObserver(() => this.updateFades());
      observer.observe(el);
      observer.observe(el.firstElementChild);
    });
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
  }

  /** @internal */
  protected updateFades(): void {
    const el = this.scroller().nativeElement;
    const maxScroll = el.scrollWidth - el.clientWidth;
    // scrollLeft runs 0..-max in RTL; normalize to the hidden width per physical edge.
    const fromStart = Math.abs(el.scrollLeft);
    const rtl = (this.rtl ??= getComputedStyle(el).direction === 'rtl');
    const [left, right] = rtl
      ? [maxScroll - fromStart, fromStart]
      : [fromStart, maxScroll - fromStart];
    const next = { left: left > 1, right: right > 1 };
    const prev = this.fades();
    if (prev.left !== next.left || prev.right !== next.right) this.fades.set(next);
  }
}

/**
 * Follow-up suggestion chips shown after a completed run: one button per
 * thread suggestion (its `title` or `prompt`, plus its `label`) that sends
 * the prompt. Renders nothing while the thread is empty or running, or has no
 * suggestions. `aui-thread` renders it above its composer.
 *
 * @example
 * ```html
 * <aui-follow-up-suggestions />
 * ```
 */
@Component({
  selector: 'aui-follow-up-suggestions',
  standalone: true,
  imports: [AuiIfDirective, AuiFollowUpSuggestionsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<aui-follow-up-suggestions-row *auiIf="visible" />`,
})
export class AuiFollowUpSuggestionsComponent {
  /** @internal */
  protected readonly visible = (s: AssistantState): boolean =>
    !s.thread.isEmpty && !s.thread.isRunning && s.thread.suggestions.length > 0;
}
