// Ported from packages/ui/src/components/vue/assistant-ui/reasoning.vue @ 7d74276
// and packages/ui/src/components/react/assistant-ui/elements/reasoning{,.aui}.tsx @ 7d74276
// (duration label, shimmer, fades and the scroll-locked root)
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { injectAui, injectAuiState, injectScrollLock } from 'angular-assistant-ui';
import {
  AuiCollapsibleComponent,
  AuiCollapsibleContentComponent,
  AuiCollapsibleTriggerDirective,
} from './collapsible/collapsible';
import { AuiIconComponent } from './icons/icon.component';

const ANIMATION_DURATION = 200;

interface ReasoningPartLike {
  readonly type: string;
  readonly text?: string;
  readonly status?: { readonly type: string };
  readonly timing?: { readonly startedAt: number; readonly completedAt?: number };
}

/**
 * Collapsible, streaming reasoning for an assistant message. Render it as the
 * template of `reasoning` parts (`<ng-template auiPart="reasoning"><aui-reasoning />
 * </ng-template>`, or the `Reasoning` slot of the styled thread): the first
 * part of each run of consecutive reasoning parts renders the whole run in one
 * collapsible, and the other parts of the run render nothing.
 *
 * The collapsible is open while the run streams and collapses once it
 * completes, unless the user toggled it. The trigger shimmers while streaming
 * and then labels the duration, `Reasoning (3s)`: from the parts' `timing`
 * when the runtime records it, otherwise as measured while this component
 * watched the stream. The text scrolls inside a capped body that stays pinned
 * to the bottom while it streams, unless the user scrolls up. Toggling (and a
 * stream starting or ending) locks the scroll container while the body
 * animates. The text renders as plain, whitespace-preserving paragraphs.
 */
@Component({
  selector: 'aui-reasoning',
  standalone: true,
  imports: [
    AuiCollapsibleComponent,
    AuiCollapsibleTriggerDirective,
    AuiCollapsibleContentComponent,
    AuiIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-reasoning' },
  template: `
    @if (texts().length > 0) {
      <aui-collapsible
        data-slot="aui_reasoning-root"
        class="aui-reasoning-root"
        [attr.data-streaming]="streaming() ? '' : null"
        [open]="open()"
        (openChange)="setOpen($event)"
      >
        <button
          type="button"
          auiCollapsibleTrigger
          data-slot="aui_reasoning-trigger"
          class="aui-reasoning-trigger"
        >
          <aui-icon class="aui-reasoning-icon" name="brain" />
          <span
            data-slot="aui_reasoning-trigger-label"
            class="aui-reasoning-label"
            [class.aui-shimmer]="streaming()"
            >{{ label() }}</span
          >
          <aui-icon class="aui-reasoning-chevron" name="chevron-down" />
        </button>
        <aui-collapsible-content
          data-slot="aui_reasoning-content"
          class="aui-reasoning-content"
          [attr.aria-busy]="streaming() ? 'true' : 'false'"
        >
          <div class="aui-reasoning-fade" data-side="top" aria-hidden="true"></div>
          <div #scroller data-slot="aui_reasoning-text" class="aui-reasoning-text">
            <div #body>
              @for (text of texts(); track $index) {
                <p class="aui-reasoning-paragraph">{{ text }}</p>
              }
            </div>
          </div>
          @if (preview()) {
            <div class="aui-reasoning-fade" data-side="bottom" aria-hidden="true"></div>
          }
        </aui-collapsible-content>
      </aui-collapsible>
    }
  `,
})
export class AuiReasoningComponent {
  private readonly aui = injectAui();
  private readonly lockScroll = injectScrollLock(inject(ElementRef), ANIMATION_DURATION);

  private readonly start = injectAuiState(() => {
    const query = this.aui.part.query as { index?: unknown } | undefined;
    return typeof query?.index === 'number' ? query.index : -1;
  });
  private readonly parts = injectAuiState((s) => s.message.parts as readonly ReasoningPartLike[]);
  private readonly self = injectAuiState((s) => s.part as ReasoningPartLike);
  private readonly messageRunning = injectAuiState((s) => s.message.status?.type === 'running');

  /** The parts of the run this component renders; empty unless it starts the run. */
  private readonly run = computed<readonly ReasoningPartLike[]>(() => {
    const parts = this.parts();
    const start = this.start();
    // Outside an index part scope, render the scoped part on its own.
    if (start < 0) return this.self().type === 'reasoning' ? [this.self()] : [];
    if (parts[start]?.type !== 'reasoning' || parts[start - 1]?.type === 'reasoning') return [];
    let end = start + 1;
    while (parts[end]?.type === 'reasoning') end++;
    return parts.slice(start, end);
  });

  /** @internal */
  protected readonly texts = computed(() => this.run().map((part) => part.text ?? ''));

  /** @internal */
  protected readonly streaming = computed(
    () => this.messageRunning() && this.run().some((part) => part.status?.type === 'running'),
  );

  private readonly userOpen = signal<boolean | null>(null);
  private wasStreaming: boolean | undefined;
  /** @internal */
  protected readonly open = computed(() => {
    const streaming = this.streaming();
    const choice = this.userOpen();
    // The body animates when a stream opens or closes it on its own.
    if (this.wasStreaming !== undefined && streaming !== this.wasStreaming && choice === null) {
      this.lockScroll();
    }
    this.wasStreaming = streaming;
    return choice ?? streaming;
  });
  /** @internal */
  protected readonly preview = computed(() => this.streaming() && this.open());

  // The span this component saw the run stream for, when the parts carry no timing.
  private watchedStart: number | undefined;
  private watchedEnd: number | undefined;
  private readonly durationMs = computed<number | undefined>(() => {
    const run = this.run();
    const streaming = this.streaming();
    if (streaming) {
      this.watchedStart ??= Date.now();
      this.watchedEnd = undefined;
      return undefined;
    }
    if (this.watchedStart !== undefined) this.watchedEnd ??= Date.now();
    const timed = run.every((part) => part.timing?.completedAt !== undefined);
    if (run.length > 0 && timed) {
      const startedAt = Math.min(...run.map((part) => part.timing!.startedAt));
      const completedAt = Math.max(...run.map((part) => part.timing!.completedAt!));
      return Math.max(0, completedAt - startedAt);
    }
    if (this.watchedStart !== undefined && this.watchedEnd !== undefined) {
      return Math.max(0, this.watchedEnd - this.watchedStart);
    }
    return undefined;
  });
  /** @internal */
  protected readonly label = computed(() => {
    const ms = this.durationMs();
    return ms === undefined ? 'Reasoning' : `Reasoning (${Math.max(1, Math.round(ms / 1000))}s)`;
  });

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const scroller = this.scroller()?.nativeElement;
      const body = this.body()?.nativeElement;
      if (!scroller || !body || typeof ResizeObserver === 'undefined') return;
      // Keep a streaming preview pinned to its newest line. A pin's own scroll
      // event can arrive after new content grew the height and read as "not at
      // bottom"; only an upward move at unchanged height is the user's intent.
      let pinned = true;
      let lastTop = scroller.scrollTop;
      let lastHeight = scroller.scrollHeight;
      const atBottom = () =>
        Math.abs(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight) <= 1 ||
        scroller.scrollHeight <= scroller.clientHeight;
      const pin = () => {
        if (!this.preview()) {
          pinned = true;
          return;
        }
        if (pinned) scroller.scrollTop = scroller.scrollHeight;
      };
      const onScroll = () => {
        if (atBottom()) pinned = true;
        else if (scroller.scrollTop < lastTop && scroller.scrollHeight === lastHeight) {
          pinned = false;
        }
        lastTop = scroller.scrollTop;
        lastHeight = scroller.scrollHeight;
      };
      scroller.addEventListener('scroll', onScroll);
      const observer = new ResizeObserver(pin);
      observer.observe(body);
      destroyRef.onDestroy(() => {
        scroller.removeEventListener('scroll', onScroll);
        observer.disconnect();
      });
    });
  }

  /** @internal */
  protected setOpen(open: boolean): void {
    this.lockScroll();
    this.userOpen.set(open);
  }
}
