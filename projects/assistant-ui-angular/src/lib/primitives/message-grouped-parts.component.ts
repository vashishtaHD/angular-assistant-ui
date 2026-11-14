// Ported from packages/core/src/react/primitives/message/MessageGroupedParts.tsx @ 7d74276
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
  forwardRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { getMessagePartKeys } from '@assistant-ui/core/internal';
import type { AuiConfig } from '@assistant-ui/store/client';
import { partScopeConfig } from '../scope/part-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import {
  GROUPBY_MEMO_KEY,
  buildGroupTree,
  getGroupSummary,
  groupMessagePartsByParentId,
  type GroupByContext,
  type GroupingFunction,
  type GroupCounts,
  type GroupNode,
  type PartState,
  type PartStatus,
} from '../utils/group-parts';
import type { MessagePartTiming } from '@assistant-ui/core';
import {
  AuiPartViewComponent,
  type AuiPartTemplateContext,
  type AuiPartTemplates,
} from './part-view.component';
import { AuiPartTemplateDirective } from './message-parts.component';

/**
 * A coalesced group of adjacent parts. `type` is the group key (always
 * `group-...`); `status` is running when any contained part runs, otherwise
 * it mirrors the last contained part.
 */
export interface AuiGroupPart<TKey extends `group-${string}` = `group-${string}`> {
  readonly type: TKey;
  /** The cluster key, for groups made by a `groupingFunction`. */
  readonly groupKey?: string;
  readonly status: PartStatus;
  /** Per-status tallies over `indices`; they sum to `indices.length`. */
  readonly counts: GroupCounts;
  /** Indices of the group's parts in the message. */
  readonly indices: readonly number[];
  /** Wall-clock span of the group's timed parts; absent when none carries timing. */
  readonly timing?: MessagePartTiming;
}

/** The synthetic trailing slot for a streaming affordance; only emitted while the message runs. */
export interface AuiIndicatorPart {
  readonly type: 'indicator';
}

/**
 * When to emit the synthetic indicator. It is only ever emitted while the
 * message is running: `never`; `empty` (no parts yet); `no-text` (default:
 * no parts yet or the last part is neither text nor reasoning); `always`.
 */
export type AuiIndicatorMode = 'never' | 'empty' | 'no-text' | 'always';

/** Maps a part to its group-key path; `[]` or `null` leaves it ungrouped. */
export type AuiGroupBy<TKey extends `group-${string}` = `group-${string}`> = (
  part: PartState,
  context: GroupByContext,
) => readonly TKey[] | null;

/** The context of an `ng-template auiGroup`: the group and its parts. */
export interface AuiGroupTemplateContext<TKey extends `group-${string}` = `group-${string}`> {
  /** The group (`let-group`). */
  $implicit: AuiGroupPart<TKey>;
  /** The group, for `let-group="group"`. */
  group: AuiGroupPart<TKey>;
  /** The states of the group's parts, in order. */
  parts: readonly PartState[];
}

/** The context of an `ng-template auiIndicator`. */
export interface AuiIndicatorTemplateContext {
  /** The indicator slot (`let-indicator`). */
  $implicit: AuiIndicatorPart;
}

/**
 * Marks an `<ng-template>` that {@link AuiMessageGroupedPartsComponent}
 * renders for groups with one key (`group-...`), or `default` for groups
 * without their own template. Render the group's nested content with
 * `<aui-group-children [group]="group" />`.
 *
 * @example
 * ```html
 * <ng-template auiGroup="group-tool" let-group let-parts="parts">
 *   <details><summary>{{ parts.length }} tools</summary>
 *     <aui-group-children [group]="group" />
 *   </details>
 * </ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[auiGroup]',
  standalone: true,
})
export class AuiGroupTemplateDirective {
  /** The group key this template renders, or `default`. */
  readonly auiGroup = input.required<string>();
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<AuiGroupTemplateContext>>(TemplateRef);

  /** Types the template context (`let-group`, `let-parts="parts"`). */
  static ngTemplateContextGuard(
    directive: AuiGroupTemplateDirective,
    context: unknown,
  ): context is AuiGroupTemplateContext {
    void directive;
    void context;
    return true;
  }
}

/**
 * Marks the `<ng-template>` {@link AuiMessageGroupedPartsComponent} renders
 * as the trailing indicator while the message streams (see `indicator`).
 *
 * @example
 * ```html
 * <ng-template auiIndicator><span class="dots">...</span></ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[auiIndicator]',
  standalone: true,
})
export class AuiIndicatorTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<AuiIndicatorTemplateContext>>(TemplateRef);
}

/** The context of an `ng-template auiEmpty`: the message status. */
export interface AuiEmptyTemplateContext {
  /** The status of the message (`let-status`). */
  $implicit: PartStatus;
}

/**
 * Marks the `<ng-template>` that {@link AuiMessageGroupedPartsComponent}
 * (as `aui-message-parts-grouped`) renders for a message with no parts
 * (React's `components.Empty`). Without it, an empty paragraph renders, with
 * a trailing marker while the message runs. Not used by `groupBy` mode.
 *
 * @example
 * ```html
 * <aui-message-parts-grouped>
 *   <ng-template auiEmpty let-status>Thinking... ({{ status.type }})</ng-template>
 * </aui-message-parts-grouped>
 * ```
 */
@Directive({
  selector: 'ng-template[auiEmpty]',
  standalone: true,
})
export class AuiEmptyTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<AuiEmptyTemplateContext>>(TemplateRef);
}

interface RenderGroup {
  readonly kind: 'group';
  readonly trackKey: string;
  readonly group: AuiGroupPart;
  readonly context: AuiGroupTemplateContext;
  readonly children: readonly RenderNode[];
}

interface RenderLeaf {
  readonly kind: 'leaf';
  readonly trackKey: string;
  readonly index: number;
}

type RenderNode = RenderGroup | RenderLeaf;

interface LeafEntry {
  index: number;
  config: AuiConfig;
}

const shouldShowIndicator = (
  mode: AuiIndicatorMode,
  parts: readonly PartState[],
  isRunning: boolean,
): boolean => {
  // A streaming affordance: never shown on a settled message.
  if (!isRunning) return false;
  switch (mode) {
    case 'never':
      return false;
    case 'always':
      return true;
    case 'empty':
      return parts.length === 0;
    case 'no-text': {
      const last = parts[parts.length - 1];
      return last === undefined || (last.type !== 'text' && last.type !== 'reasoning');
    }
  }
};

/**
 * Groups adjacent message parts into a tree of coalesced runs and renders
 * each group through an `ng-template auiGroup` and each part through the
 * same renderers as `aui-message-parts` (an `ng-template auiPart`, a
 * registered tool or data UI, or the text fallback). Adds no box of its own
 * (`display: contents`).
 *
 * `groupBy` maps each part to a group-key path (keys start with `group-`);
 * adjacent parts sharing a path prefix coalesce into the same group, and
 * `[]` leaves a part ungrouped. Prefer {@link groupPartByType}: it carries a
 * memo fingerprint so the tree survives re-creation of the function. The
 * second argument is a {@link GroupByContext} with the tool UI registry.
 *
 * A group without a template for its key (or a `default`) renders its
 * children directly. While the message runs, an `ng-template auiIndicator`
 * renders after the last node according to `indicator`.
 *
 * @example
 * ```html
 * <aui-message-grouped-parts [groupBy]="groupBy">
 *   <ng-template auiGroup="group-thought" let-group>
 *     <details><aui-group-children [group]="group" /></details>
 *   </ng-template>
 *   <ng-template auiPart="text"><aui-part-text /></ng-template>
 *   <ng-template auiIndicator>...</ng-template>
 * </aui-message-grouped-parts>
 * ```
 * ```ts
 * readonly groupBy = groupPartByType({
 *   reasoning: ['group-thought'],
 *   'tool-call': ['group-thought'],
 * });
 * ```
 */
@Component({
  selector: 'aui-message-grouped-parts, aui-message-parts-grouped',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    AuiScopeOutletComponent,
    AuiPartViewComponent,
    forwardRef(() => AuiGroupChildrenComponent),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #partView
      ><aui-part-view [templates]="partTemplates()" [templatesFirst]="true"
    /></ng-template>
    <ng-template #nodeTemplate let-node>
      @if (node.kind === 'group') {
        @if (groupTemplate(node.group.type); as template) {
          <ng-container *ngTemplateOutlet="template; context: node.context; injector: injector" />
        } @else {
          <aui-group-children [group]="node.group" />
        }
      } @else {
        <aui-scope-outlet [config]="configFor(node)" [template]="partView" />
      }
    </ng-template>
    @for (node of nodes(); track node.trackKey) {
      <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: node }" />
    }
    @if (showEmpty()) {
      @if (emptyTemplate(); as template) {
        <ng-container *ngTemplateOutlet="template; context: emptyContext(); injector: injector" />
      } @else {
        <p style="white-space: pre-line">
          @if (messageStatus().type === 'running') {
            <span style="font-family: revert">{{ ' ●' }}</span>
          }
        </p>
      }
    }
    @if (showIndicator()) {
      @if (indicatorTemplate(); as template) {
        <ng-container *ngTemplateOutlet="template; context: indicatorContext; injector: injector" />
      }
    }
  `,
})
export class AuiMessageGroupedPartsComponent {
  /** Maps each part to a group-key path; see the class docs. */
  readonly groupBy = input<AuiGroupBy | undefined>(undefined);
  /**
   * Clusters parts by indices instead of adjacent paths (React's
   * `Unstable_PartsGrouped`): the groups need not be adjacent. A keyed
   * group renders as `group-<key>` (its `groupKey` is on the group); an
   * unkeyed one as `group-` with no `groupKey`, like React's `Group` call
   * with an undefined key (without a template it renders its children). Without `groupBy` or this input the
   * parts cluster by `parentId` (`Unstable_PartsGroupedByParentId`); use it
   * through the `aui-message-parts-grouped` selector.
   */
  readonly groupingFunction = input<GroupingFunction | undefined>(undefined);
  /** When to emit the trailing indicator. @default 'no-text' */
  readonly indicator = input<AuiIndicatorMode>('no-text');

  private readonly partTemplateDirectives = contentChildren(AuiPartTemplateDirective);
  private readonly groupTemplateDirectives = contentChildren(AuiGroupTemplateDirective);
  private readonly indicatorDirective = contentChild(AuiIndicatorTemplateDirective);
  private readonly emptyDirective = contentChild(AuiEmptyTemplateDirective);

  /** The recursive node template; read by {@link AuiGroupChildrenComponent}. */
  readonly nodeTemplate = viewChild.required<TemplateRef<unknown>>('nodeTemplate');

  /** Renders projected templates in this component's scope. */
  protected readonly injector = inject(Injector);
  protected readonly indicatorContext: AuiIndicatorTemplateContext = {
    $implicit: Object.freeze({ type: 'indicator' as const }),
  };

  private readonly aui = injectAui();
  private readonly parts = injectAuiState((s) => s.message.parts);
  private readonly toolUIs = injectAuiState((s) => s.optional.tools?.toolUIs);
  private readonly isRunning = injectAuiState((s) =>
    this.indicator() === 'never' ? false : s.message.status?.type === 'running',
  );

  /** Part templates by part type; the first one for a type wins. */
  protected readonly partTemplates = computed<AuiPartTemplates>(() => {
    const map = new Map<string, TemplateRef<AuiPartTemplateContext>>();
    for (const directive of this.partTemplateDirectives()) {
      const type = directive.auiPart();
      if (!map.has(type)) map.set(type, directive.templateRef);
    }
    return map;
  });

  private readonly groupTemplates = computed(() => {
    const map = new Map<string, TemplateRef<AuiGroupTemplateContext>>();
    for (const directive of this.groupTemplateDirectives()) {
      const key = directive.auiGroup();
      if (!map.has(key)) map.set(key, directive.templateRef);
    }
    return map;
  });

  protected readonly emptyTemplate = computed(() => this.emptyDirective()?.templateRef);
  protected readonly messageStatus = injectAuiState<PartStatus>(
    (s) => (s.message.status ?? { type: 'complete' }) as PartStatus,
  );
  protected readonly emptyContext = computed<AuiEmptyTemplateContext>(() => ({
    $implicit: this.messageStatus(),
  }));
  /** True for a message with no parts in `groupingFunction` / parent-id mode. */
  protected readonly showEmpty = computed(
    () => this.groupBy() === undefined && this.parts().length === 0,
  );
  protected readonly indicatorTemplate = computed(() => this.indicatorDirective()?.templateRef);

  /** Memo fingerprint of `groupBy`: its identity unless it carries one. */
  private readonly groupByKey = computed(
    () => {
      const fn = this.groupBy() as (AuiGroupBy & { [GROUPBY_MEMO_KEY]?: string }) | undefined;
      return fn?.[GROUPBY_MEMO_KEY] ?? fn;
    },
    { equal: Object.is },
  );

  private readonly childrenByGroup = new WeakMap<AuiGroupPart, readonly RenderNode[]>();

  /** The render tree: rebuilt when the parts, the tool UIs or the grouping change. */
  protected readonly nodes = computed<readonly RenderNode[]>(() => {
    const parts = this.parts();
    const toolUIs = this.toolUIs();
    this.groupByKey();
    const groupBy = untracked(this.groupBy);
    if (!groupBy) return this.clusteredNodes(parts);
    const context: GroupByContext = toolUIs ? { toolUIs } : {};
    const tree = buildGroupTree(
      parts.map((part) => groupBy(part, context) ?? []),
      getMessagePartKeys(parts),
    );
    const toRender = (node: GroupNode): RenderNode => {
      if (node.type === 'part') {
        return {
          kind: 'leaf',
          trackKey: node.idKey ? `part-${node.idKey}` : `part-${node.index}`,
          index: node.index,
        };
      }
      const summary = getGroupSummary(parts, node.indices);
      const group: AuiGroupPart = {
        type: node.key as `group-${string}`,
        status: summary.status,
        counts: summary.counts,
        indices: node.indices,
        ...(summary.timing && { timing: summary.timing }),
      };
      const children = node.children.map(toRender);
      this.childrenByGroup.set(group, children);
      return {
        kind: 'group',
        trackKey: JSON.stringify([node.key, node.idKey ?? node.nodeKey]),
        group,
        context: { $implicit: group, group, parts: node.indices.map((i) => parts[i]!) },
        children,
      };
    };
    return tree.map(toRender);
  });

  /** The render tree for `groupingFunction` / parent-id clustering. */
  private clusteredNodes(parts: readonly PartState[]): readonly RenderNode[] {
    const grouping = this.groupingFunction() ?? groupMessagePartsByParentId;
    const keys = getMessagePartKeys(parts);
    const seen = new Set<string>();
    const leaf = (index: number): RenderLeaf => {
      let trackKey = `part-${keys[index] ?? index}`;
      while (seen.has(trackKey)) trackKey += `@${index}`;
      seen.add(trackKey);
      return { kind: 'leaf', trackKey, index };
    };
    const nodes: RenderNode[] = [];
    grouping(parts).forEach(({ groupKey, indices }, groupIndex) => {
      if (indices.length === 0) return;
      const leaves = indices.map(leaf);
      const summary = getGroupSummary(parts, indices);
      const group: AuiGroupPart = {
        type: `group-${groupKey ?? ''}`,
        ...(groupKey !== undefined && { groupKey }),
        status: summary.status,
        counts: summary.counts,
        indices,
        ...(summary.timing && { timing: summary.timing }),
      };
      this.childrenByGroup.set(group, leaves);
      const identity = keys[indices[0]!];
      nodes.push({
        kind: 'group',
        trackKey: JSON.stringify([
          'group',
          groupKey ?? null,
          identity?.includes(':') ? `id:${identity}` : groupIndex,
        ]),
        group,
        context: { $implicit: group, group, parts: indices.map((i) => parts[i]!) },
        children: leaves,
      });
    });
    return nodes;
  }

  /** True while the trailing indicator should render. */
  protected readonly showIndicator = computed(() =>
    shouldShowIndicator(this.indicator(), this.parts(), this.isRunning()),
  );

  private readonly leaves = new Map<string, LeafEntry>();
  private prunedFor: readonly RenderNode[] | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.leaves.clear();
    });
  }

  /** The nested nodes of `group`, for {@link AuiGroupChildrenComponent}. */
  childrenOf(group: AuiGroupPart): readonly RenderNode[] {
    return this.childrenByGroup.get(group) ?? [];
  }

  /** The template for groups with `key`, falling back to `default`. */
  protected groupTemplate(key: string): TemplateRef<AuiGroupTemplateContext> | undefined {
    const templates = this.groupTemplates();
    return templates.get(key) ?? templates.get('default');
  }

  /** Returns the memoised scope config for the leaf `node`. */
  protected configFor(node: RenderLeaf): AuiConfig {
    const nodes = this.nodes();
    if (nodes !== this.prunedFor) {
      this.prunedFor = nodes;
      const live = new Set<string>();
      const collect = (list: readonly RenderNode[]) => {
        for (const entry of list) {
          if (entry.kind === 'leaf') live.add(entry.trackKey);
          else collect(entry.children);
        }
      };
      collect(nodes);
      for (const known of this.leaves.keys()) {
        if (!live.has(known)) this.leaves.delete(known);
      }
    }
    const existing = this.leaves.get(node.trackKey);
    if (existing && existing.index === node.index) return existing.config;
    const aui = this.aui;
    const index = node.index;
    const entry: LeafEntry = {
      index,
      // As in aui-message-parts: "current" consults the live parts, so the
      // stale diagnostic stays silent for a part that left the message.
      config: partScopeConfig(aui, index, () => {
        if (this.destroyed || this.leaves.get(node.trackKey) !== entry) return false;
        try {
          return index < aui.message.getState().parts.length;
        } catch {
          return false;
        }
      }),
    };
    this.leaves.set(node.trackKey, entry);
    return entry.config;
  }
}

/**
 * Renders the nested content (subgroups and parts) of a group inside an
 * `ng-template auiGroup` of {@link AuiMessageGroupedPartsComponent}.
 *
 * @example
 * ```html
 * <ng-template auiGroup="group-tool" let-group>
 *   <div class="tools"><aui-group-children [group]="group" /></div>
 * </ng-template>
 * ```
 */
@Component({
  selector: 'aui-group-children',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (node of nodes(); track node.trackKey) {
      <ng-container *ngTemplateOutlet="owner.nodeTemplate(); context: { $implicit: node }" />
    }
  `,
})
export class AuiGroupChildrenComponent {
  /** The group (`let-group`) whose content to render. */
  readonly group = input.required<AuiGroupPart>();

  /** The owning grouped parts component. */
  protected readonly owner = inject(AuiMessageGroupedPartsComponent);
  protected readonly nodes = computed(() => this.owner.childrenOf(this.group()));
}
