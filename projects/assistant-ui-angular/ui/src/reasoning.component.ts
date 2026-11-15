// Ported from packages/ui/src/components/vue/assistant-ui/reasoning.vue @ 7d74276
// and packages/ui/src/components/react/assistant-ui/elements/reasoning{,.aui}.tsx @ 7d74276
// (duration label, shimmer, fades and the scroll-locked root; ReasoningRoot, ReasoningTrigger,
// ReasoningContent and ReasoningText as aui-reasoning-group); each part renders through
// MarkdownText in its own PartByIndexProvider scope, as reasoning.vue does
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type OnChanges,
  type SimpleChanges,
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
 * The collapsible frame of a run of reasoning: a "Reasoning" trigger and a
 * capped, scrolling body holding the projected content (upstream's
 * `ReasoningRoot`, `ReasoningTrigger`, `ReasoningContent` and `ReasoningText`).
 * `aui-reasoning` renders its run in one; the styled thread renders each
 * `group-reasoning` group in one (its `ReasoningGroup` slot).
 *
 * It is open while `streaming` and collapses when the stream ends, unless the
 * user toggled it. The trigger shimmers while streaming and then labels the
 * duration, `Reasoning (3s)`: `durationMs` when given, otherwise as measured
 * between the `streaming` changes it saw. The body stays pinned to the bottom
 * while it streams, unless the user scrolls up. Toggling (and a stream
 * starting or ending) locks the scroll container while the body animates.
 *
 * @example
 * ```html
 * <aui-reasoning-group [streaming]="group.status.type === 'running'">
 *   <aui-group-children [group]="group" />
 * </aui-reasoning-group>
 * ```
 */
@Component({
  selector: 'aui-reasoning-group',
  standalone: true,
  imports: [
    AuiCollapsibleComponent,
    AuiCollapsibleTriggerDirective,
    AuiCollapsibleContentComponent,
    AuiIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-reasoning-group' },
  template: `
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
          <div #body><ng-content /></div>
        </div>
        @if (preview()) {
          <div class="aui-reasoning-fade" data-side="bottom" aria-hidden="true"></div>
        }
      </aui-collapsible-content>
    </aui-collapsible>
  `,
})
export class AuiReasoningGroupComponent implements OnChanges {
  /** Whether the reasoning is streaming. */
  readonly streaming = input(false, { transform: booleanAttribute });
  /** The duration to label once the stream ended; measured when absent. */
  readonly durationMs = input<number | undefined>(undefined);

  private readonly lockScroll = injectScrollLock(inject(ElementRef), ANIMATION_DURATION);
  private readonly userOpen = signal<boolean | null>(null);
  /** @internal */
  protected readonly open = computed(() => this.userOpen() ?? this.streaming());
  /** @internal */
  protected readonly preview = computed(() => this.streaming() && this.open());

  // The span this component saw `streaming` cover, for a missing `durationMs`.
  private readonly watched = signal<{ start: number; end?: number } | undefined>(undefined);
  /** @internal */
  protected readonly label = computed(() => {
    if (this.streaming()) return 'Reasoning';
    const watched = this.watched();
    const ms =
      this.durationMs() ??
      (watched?.end === undefined ? undefined : Math.max(0, watched.end - watched.start));
    return ms === undefined ? 'Reasoning' : `Reasoning (${Math.max(1, Math.round(ms / 1000))}s)`;
  });

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const scroller = this.scroller().nativeElement;
      const body = this.body().nativeElement;
      if (typeof ResizeObserver === 'undefined') return;
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

  /** Times the stream and locks the scroll container when it opens or closes the body. */
  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['streaming'];
    if (!change) return;
    const streaming = this.streaming();
    const previous = change.firstChange ? undefined : !!change.previousValue;
    if (streaming === previous) return;
    if (streaming) {
      this.watched.set({ start: Date.now() });
    } else if (previous) {
      const watched = this.watched();
      if (watched) this.watched.set({ start: watched.start, end: Date.now() });
    }
    // The body animates when a stream opens or closes it on its own.
    if (previous !== undefined && this.userOpen() === null) this.lockScroll();
  }

  /** @internal */
  protected setOpen(open: boolean): void {
    this.lockScroll();
    this.userOpen.set(open);
  }
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
 * </ng-template>`): the first part of each run of consecutive reasoning parts
 * renders the whole run in one `aui-reasoning-group`, and the other parts of
 * the run render nothing. (The styled thread groups the parts itself and
 * renders `aui-reasoning-group` around them instead.)
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
  imports: [AuiReasoningGroupComponent, AuiProviderDirective, AuiMarkdownTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-reasoning' },
  template: `
    @if (run().length > 0) {
      <aui-reasoning-group [streaming]="streaming()" [durationMs]="durationMs()">
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
      </aui-reasoning-group>
    }
  `,
})
export class AuiReasoningComponent {
  /** @internal */
  protected readonly aui = injectAui();

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

  // The span this component saw the run stream for, when the parts carry no
  // timing. Written from the store subscription, at the transition itself.
  private readonly watched = signal<{ start: number; end?: number } | undefined>(undefined);
  /** @internal */
  protected readonly durationMs = computed<number | undefined>(() => {
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

  private readonly configs = new Map<number, AuiConfig>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.configs.clear());

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
      },
    );
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
}
