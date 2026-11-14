// Ported from packages/vue/src/primitives/MessagePrimitiveParts.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  Injector,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  inject,
  input,
} from '@angular/core';
import { ChainOfThoughtClient } from '@assistant-ui/core/store';
import type { ChainOfThoughtPart } from '@assistant-ui/core/store';
import { getMessagePartKeys } from '@assistant-ui/core/internal';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import { partScopeConfig } from '../scope/part-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { stableKeys } from '../scope/stable-keys';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import {
  AuiPartViewComponent,
  type AuiPartTemplateContext,
  type AuiPartTemplates,
} from './part-view.component';

export type { AuiPartTemplateContext } from './part-view.component';

/**
 * Marks an `<ng-template>` that {@link AuiMessagePartsComponent} renders for
 * parts of one type: `text`, `reasoning`, `tool-call`, `data`, ... or
 * `default` for types without their own template. The template's implicit
 * context is the current part state (`let-part`), and it renders inside the
 * part's scope, so descendants read the part through `s.part`.
 *
 * @example
 * ```html
 * <ng-template auiPart="reasoning" let-part>
 *   <em>{{ part.type === 'reasoning' ? part.text : '' }}</em>
 * </ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[auiPart]',
  standalone: true,
})
export class AuiPartTemplateDirective {
  /** The part type this template renders, or `default`. */
  readonly auiPart = input.required<string>();
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<AuiPartTemplateContext>>(TemplateRef);

  /** Types the template context (`let-part`) as the current part state. */
  static ngTemplateContextGuard(
    directive: AuiPartTemplateDirective,
    context: unknown,
  ): context is AuiPartTemplateContext {
    void directive;
    void context;
    return true;
  }
}

/**
 * Marks the `<ng-template>` that {@link AuiMessagePartsComponent} renders for
 * each chain of thought. Its presence turns grouping on, like React's
 * `components.ChainOfThought`: every run of consecutive `reasoning` and
 * `tool-call` parts becomes one chain of thought, rendered by this template
 * inside a chain of thought scope (`s.chainOfThought`). The template
 * normally holds an `auiChainOfThoughtRoot`, an
 * `auiChainOfThoughtAccordionTrigger` and an `<aui-chain-of-thought-parts>`.
 *
 * @example
 * ```html
 * <aui-message-parts>
 *   <ng-template auiChainOfThought>
 *     <div auiChainOfThoughtRoot>
 *       <button auiChainOfThoughtAccordionTrigger>Reasoning</button>
 *       <aui-chain-of-thought-parts>...</aui-chain-of-thought-parts>
 *     </div>
 *   </ng-template>
 * </aui-message-parts>
 * ```
 */
@Directive({
  selector: 'ng-template[auiChainOfThought]',
  standalone: true,
})
export class AuiChainOfThoughtTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/** Internal: renders the chain of thought template inside its scope. */
@Component({
  selector: 'aui-chain-of-thought-host',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<ng-container *ngTemplateOutlet="template(); injector: injector" />`,
})
export class AuiChainOfThoughtHostComponent {
  /** The template to render. */
  readonly template = input.required<TemplateRef<unknown>>();
  /** Renders the template in the chain of thought scope. */
  protected readonly injector = inject(Injector);
}

/** One rendered range of parts: a single part or a chain of thought. */
type PartRange =
  | { kind: 'single'; key: string; index: number }
  | { kind: 'chain'; key: string; start: number; end: number };

/**
 * Groups consecutive `reasoning` and `tool-call` parts into chain of thought
 * ranges; every other part is a single range. A group keyed by an id-bearing
 * first part (`id:<partId>`) keeps its identity when it grows.
 */
const chainRanges = (types: readonly string[], partIds: readonly string[]): PartRange[] => {
  const ranges: PartRange[] = [];
  const claimed = new Set<string>();
  let start = -1;
  const endGroup = (end: number) => {
    if (start === -1) return;
    const id = partIds[start];
    let identity: string | number = start;
    if (id?.includes(':') && !claimed.has(id)) {
      claimed.add(id);
      identity = `id:${id}`;
    }
    ranges.push({
      kind: 'chain',
      key: JSON.stringify(['chainOfThoughtGroup', identity]),
      start,
      end,
    });
    start = -1;
  };
  types.forEach((type, i) => {
    if (type === 'tool-call' || type === 'reasoning') {
      if (start === -1) start = i;
    } else {
      endGroup(i - 1);
      ranges.push({ kind: 'single', key: partIds[i] ?? String(i), index: i });
    }
  });
  endGroup(types.length - 1);
  return ranges;
};

/** True when the current message of `aui` has a part at `index`. */
const hasPart = (aui: AssistantClient, index: number): boolean => {
  try {
    return index < aui.message.getState().parts.length;
  } catch {
    // The message scope is already gone (its row is being torn down).
    return false;
  }
};

interface PartEntry {
  index: number;
  config: AuiConfig;
}

/**
 * Renders the current message's content parts in order, each scoped to its
 * part (descendants read it through `s.part`) and keyed by the part's
 * identity, so a streaming part keeps its DOM. Adds no box of its own
 * (`display: contents`).
 *
 * A `tool-call` part first resolves a UI registered in the `tools` scope by
 * tool name ({@link registerToolUI}, `aui.tools.setToolUI`, or a
 * `Tools({ toolkit })` config entry): a toolkit `renderText` descriptor
 * renders its string or number result; a registered component renders with a
 * single `tool` input of type {@link ToolUIProps}; an MCP app renderer
 * handles `ui://` resources. A `data` part resolves a registered data
 * renderer (single `data` input of type {@link DataUIProps}). Otherwise an
 * `ng-template auiPart` for the part type renders it, falling back to the
 * `default` template; text parts always render (as
 * `<p style="white-space: pre-line">`) unless a `text` template overrides
 * them.
 *
 * @example
 * ```html
 * <aui-message-parts>
 *   <ng-template auiPart="tool-call" let-part>
 *     <code>{{ part.type === 'tool-call' ? part.toolName : '' }}</code>
 *   </ng-template>
 * </aui-message-parts>
 * ```
 */
@Component({
  selector: 'aui-message-parts',
  standalone: true,
  imports: [AuiScopeOutletComponent, AuiPartViewComponent, AuiChainOfThoughtHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #partView><aui-part-view [templates]="templateMap()" /></ng-template>
    <ng-template #chainView
      ><aui-chain-of-thought-host [template]="chainTemplate()!"
    /></ng-template>
    @if (chainTemplate()) {
      @for (range of ranges(); track range.key) {
        @if (range.kind === 'single') {
          <aui-scope-outlet [config]="configFor(range.key, range.index)" [template]="partView" />
        } @else {
          <aui-scope-outlet [config]="chainConfigFor(range)" [template]="chainView" />
        }
      }
    } @else {
      @for (key of keys(); track key) {
        <aui-scope-outlet [config]="configFor(key, $index)" [template]="partView" />
      }
    }
  `,
})
export class AuiMessagePartsComponent {
  private readonly templates = contentChildren(AuiPartTemplateDirective);

  /** Projected templates by part type; the first one for a type wins. */
  protected readonly templateMap = computed<AuiPartTemplates>(() => {
    const map = new Map<string, TemplateRef<AuiPartTemplateContext>>();
    for (const directive of this.templates()) {
      const type = directive.auiPart();
      if (!map.has(type)) map.set(type, directive.templateRef);
    }
    return map;
  });

  private readonly aui = injectAui();
  private readonly parts = injectAuiState((s) => s.message.parts);
  /** The part keys, stable while they keep the same order. */
  protected readonly keys = stableKeys(() => getMessagePartKeys(this.parts()));

  private readonly chainTemplateDirective = contentChild(AuiChainOfThoughtTemplateDirective);
  /** The projected chain of thought template; grouping is on while it exists. */
  protected readonly chainTemplate = computed(() => this.chainTemplateDirective()?.templateRef);
  private readonly types = injectAuiState((s) => s.message.parts.map((part) => part.type));
  /** The ranges to render while a chain of thought template is projected. */
  protected readonly ranges = computed(() => chainRanges(this.types(), this.keys()));
  private readonly chains = new Map<
    string,
    { parts: readonly unknown[]; start: number; end: number; config: AuiConfig }
  >();

  private readonly entries = new Map<string, PartEntry>();
  private prunedFor: readonly string[] | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.entries.clear();
    });
  }

  /** Returns the memoised chain of thought scope config for `range`. */
  protected chainConfigFor(range: PartRange & { kind: 'chain' }): AuiConfig {
    const parts = this.parts();
    const known = this.chains.get(range.key);
    if (known && known.parts === parts && known.start === range.start && known.end === range.end) {
      return known.config;
    }
    const aui = this.aui;
    const { start, end } = range;
    const slice = parts.slice(start, end + 1) as ChainOfThoughtPart[];
    const config = AuiConfig({
      chainOfThought: ChainOfThoughtClient({
        parts: slice,
        getMessagePart: ({ index }) => {
          if (index < 0 || slice.length === 0) {
            throw new Error(
              `ChainOfThought part index ${index} is out of bounds (0..${slice.length - 1})`,
            );
          }
          // A row of a part that just left the chain can still look itself up
          // for a moment (its scope item is served from the last-valid
          // cache). Upstream throws there; clamping keeps that window quiet
          // and the scope serves the chain's last part instead.
          index = Math.min(index, slice.length - 1);
          return aui.message.part({ index: start + index });
        },
      }),
    });
    this.chains.set(range.key, { parts, start, end, config });
    if (this.chains.size > this.ranges().length) {
      const live = new Set(this.ranges().map((r) => r.key));
      for (const k of this.chains.keys()) if (!live.has(k)) this.chains.delete(k);
    }
    return config;
  }

  /** Returns the memoised scope config for the part `key` at `index`. */
  protected configFor(key: string, index: number): AuiConfig {
    const keys = this.keys();
    if (keys !== this.prunedFor) {
      this.prunedFor = keys;
      const live = new Set(keys);
      for (const known of this.entries.keys()) {
        if (!live.has(known)) this.entries.delete(known);
      }
    }
    const existing = this.entries.get(key);
    if (existing && existing.index === index) return existing.config;
    const aui = this.aui;
    const entry: PartEntry = {
      index,
      // Dev stale diagnostic intentionally silenced (as for message rows):
      // the cache's microtask expiry runs before change detection removes a
      // row whose part left the message, so "current" must consult the live
      // parts. That makes `isCurrent` equal `isValid`, and the reporter never
      // fires; a moved key gets a new entry, so the old one is not current.
      config: partScopeConfig(
        aui,
        index,
        () => !this.destroyed && this.entries.get(key) === entry && hasPart(aui, index),
      ),
    };
    this.entries.set(key, entry);
    return entry.config;
  }
}
