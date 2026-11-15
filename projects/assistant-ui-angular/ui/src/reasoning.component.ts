// Ported from packages/ui/src/components/vue/assistant-ui/reasoning.vue @ 7d74276
// and packages/ui/src/components/react/assistant-ui/elements/reasoning{,.aui}.tsx @ 7d74276
// (duration label, shimmer, fades and the scroll-locked root); each part renders through
// MarkdownText in its own PartByIndexProvider scope, as reasoning.vue does
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
import { AuiConfig, Derived, type AssistantClient } from '@assistant-ui/store/client';
import {
  AuiProviderDirective,
  injectAui,
  injectAuiState,
  injectScrollLock,
} from 'angular-assistant-ui';
import { AuiMarkdownTextComponent } from 'angular-assistant-ui/markdown';
import {
  AuiCollapsibleComponent,
  AuiCollapsibleContentComponent,
  AuiCollapsibleTriggerDirective,
} from './collapsible/collapsible';
import { AuiIconComponent } from './icons/icon.component';
import { watchAuiState } from './watch-aui-state';

const ANIMATION_DURATION = 200;

interface ReasoningPartLike {
  readonly type: string;
  readonly text?: string;
  readonly status?: { readonly type: string };
  readonly timing?: { readonly startedAt: number; readonly completedAt?: number };
}

/**
 * The indices of the run that starts at `start`: empty unless `start` is a
 * reasoning part that does not follow another reasoning part.
 */
const runIndices = (parts: readonly ReasoningPartLike[], start: number): readonly number[] => {
  if (parts[start]?.type !== 'reasoning' || parts[start - 1]?.type === 'reasoning') return [];
  let end = start + 1;
  while (parts[end]?.type === 'reasoning') end++;
  return Array.from({ length: end - start }, (_, offset) => start + offset);
};

/** The parts of the run this component renders; `start` is -1 outside an index part scope. */
const runParts = (
  parts: readonly ReasoningPartLike[],
  self: ReasoningPartLike,
  start: number,
): readonly ReasoningPartLike[] => {
  // Outside an index part scope, render the scoped part on its own.
  if (start < 0) return self.type === 'reasoning' ? [self] : [];
  return runIndices(parts, start).map((index) => parts[index]!);
};

const isStreaming = (messageRunning: boolean, run: readonly ReasoningPartLike[]): boolean =>
  messageRunning && run.some((part) => part.status?.type === 'running');

/**
 * The part scope of the message part at `index` (upstream's PartByIndexProvider).
 * It keeps the last valid part for the row's life: a row whose part just left
 * the message is still evaluated before change detection removes it.
 */
const partConfig = (index: number): AuiConfig => {
  let last: ReturnType<AssistantClient['message']['part']> | undefined;
  return AuiConfig({
    part: Derived({
      source: 'message',
      query: { type: 'index', index },
      get: (parent) => {
        if (index < parent.message.getState().parts.length) {
          try {
            last = parent.message.part({ index });
            return last;
          } catch {
            // The message moved on between the state read and the lookup.
          }
        }
        return last ?? parent.message.part({ index });
      },
    }),
  });
};

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
 * watched the stream. Stream starts and ends are taken from the store
 * subscription, so a stream that starts and ends between two renders is still
 * timed. Each part of the run renders as markdown (`aui-markdown-text`, from
 * the `angular-assistant-ui/markdown` entry) in its own part scope. The text
 * scrolls inside a capped body that stays pinned to the bottom while it
 * streams, unless the user scrolls up. Toggling (and a stream starting or
 * ending) locks the scroll container while the body animates.
 */
@Component({
  selector: 'aui-reasoning',
  standalone: true,
  imports: [
    AuiCollapsibleComponent,
    AuiCollapsibleTriggerDirective,
    AuiCollapsibleContentComponent,
    AuiIconComponent,
    AuiProviderDirective,
    AuiMarkdownTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-reasoning' },
  template: `
    @if (run().length > 0) {
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
              @if (start() < 0) {
                <aui-markdown-text class="aui-reasoning-part" />
              } @else {
                @for (index of indices(); track index) {
                  <div
                    class="aui-reasoning-part"
                    [auiProvider]="configFor(index)"
                    [auiProviderExtends]="aui"
                  >
                    <aui-markdown-text />
                  </div>
                }
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
  /** @internal */
  protected readonly aui = injectAui();
  private readonly lockScroll = injectScrollLock(inject(ElementRef), ANIMATION_DURATION);

  /** @internal The index of this component's part, or -1 outside an index part scope. */
  protected readonly start = injectAuiState(() => this.startIndex());
  private readonly parts = injectAuiState((s) => s.message.parts as readonly ReasoningPartLike[]);
  private readonly self = injectAuiState((s) => s.part as ReasoningPartLike);
  private readonly messageRunning = injectAuiState((s) => s.message.status?.type === 'running');

  /** @internal The indices of the run this component renders; empty unless it starts the run. */
  protected readonly indices = computed(() => runIndices(this.parts(), this.start()));
  /** @internal */
  protected readonly run = computed(() => runParts(this.parts(), this.self(), this.start()));
  /** @internal */
  protected readonly streaming = computed(() => isStreaming(this.messageRunning(), this.run()));

  private readonly userOpen = signal<boolean | null>(null);
  /** @internal */
  protected readonly open = computed(() => this.userOpen() ?? this.streaming());
  /** @internal */
  protected readonly preview = computed(() => this.streaming() && this.open());

  // The span this component saw the run stream for, when the parts carry no
  // timing. Written from the store subscription, at the transition itself.
  private readonly watched = signal<{ start: number; end?: number } | undefined>(undefined);
  private readonly durationMs = computed<number | undefined>(() => {
    if (this.streaming()) return undefined;
    const run = this.run();
    if (run.length > 0 && run.every((part) => part.timing?.completedAt !== undefined)) {
      const startedAt = Math.min(...run.map((part) => part.timing!.startedAt));
      const completedAt = Math.max(...run.map((part) => part.timing!.completedAt!));
      return Math.max(0, completedAt - startedAt);
    }
    const watched = this.watched();
    return watched?.end === undefined ? undefined : Math.max(0, watched.end - watched.start);
  });
  /** @internal */
  protected readonly label = computed(() => {
    const ms = this.durationMs();
    return ms === undefined ? 'Reasoning' : `Reasoning (${Math.max(1, Math.round(ms / 1000))}s)`;
  });

  private readonly configs = new Map<number, AuiConfig>();
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.configs.clear());

    // Stream starts and ends come straight from the store, not from a render.
    watchAuiState(
      (s) =>
        isStreaming(
          s.message.status?.type === 'running',
          runParts(
            s.message.parts as readonly ReasoningPartLike[],
            s.part as ReasoningPartLike,
            this.startIndex(),
          ),
        ),
      (streaming, previous) => {
        if (streaming) {
          this.watched.set({ start: Date.now() });
        } else if (previous) {
          const watched = this.watched();
          if (watched) this.watched.set({ start: watched.start, end: Date.now() });
        }
        // The body animates when a stream opens or closes it on its own.
        if (previous !== undefined && this.userOpen() === null) this.lockScroll();
      },
    );

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

  /** @internal The memoised part scope config for the run's part at `index`. */
  protected configFor(index: number): AuiConfig {
    let config = this.configs.get(index);
    if (!config) {
      config = partConfig(index);
      this.configs.set(index, config);
    }
    return config;
  }

  private startIndex(): number {
    const query = this.aui.part.query as { index?: unknown } | undefined;
    return typeof query?.index === 'number' ? query.index : -1;
  }

  /** @internal */
  protected setOpen(open: boolean): void {
    this.lockScroll();
    this.userOpen.set(open);
  }
}
