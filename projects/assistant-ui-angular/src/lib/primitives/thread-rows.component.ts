// Ported from packages/core/src/react/primitives/thread/ThreadRow.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (selector and types: ../utils/thread-rows.ts, ported because @assistant-ui/core/react evaluates React)
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  inject,
  input,
} from '@angular/core';
import type { PartMethods } from '@assistant-ui/core/store';
import type { AssistantState, AuiConfig } from '@assistant-ui/store/client';
import { hasMessage, messageScopeConfig } from '../scope/message-scope';
import { partScopeConfig } from '../scope/part-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import {
  createThreadRowsSelector,
  getGroupSummary,
  getThreadRowNode,
  type GroupCounts,
  type GroupNode,
  type ThreadRow,
  type ThreadRowsOptions,
} from '../utils/thread-rows';
import { AuiPartTemplateDirective } from './message-parts.component';
import {
  AuiPartViewComponent,
  type AuiPartTemplateContext,
  type AuiPartTemplates,
} from './part-view.component';
import { injectRegisteredDataRenderer, injectRegisteredToolView } from './tool-call-view';

export { createThreadRowsSelector, type ThreadRow, type ThreadRowsOptions };

/**
 * A coalesced group of adjacent parts, surfaced through the same `part` field
 * as a leaf part so a template can dispatch on `part.type`.
 */
export interface AuiThreadRowGroupPart {
  /** The group key `groupBy` returned (always `group-…`). */
  readonly type: `group-${string}`;
  /** Running when any contained part runs, otherwise the last part's status. */
  readonly status: AssistantState['part']['status'];
  /** Per-status tallies over `indices`. */
  readonly counts: GroupCounts;
  /** Indices of the contained parts. */
  readonly indices: readonly number[];
  /** Wall-clock span of the group's timed parts. */
  readonly timing?: { startedAt: number; completedAt?: number };
}

type PartState = AssistantState['part'];

/**
 * A leaf part as a row template receives it (upstream's `EnrichedPartState`).
 * A tool-call part adds `toolUI` (the default view template when a tool UI is
 * registered, else `null`) and the scoped tool actions; a data part adds
 * `dataRendererUI` likewise. Other parts are the plain part state.
 */
export type AuiThreadRowLeafPart =
  | (Extract<PartState, { type: 'tool-call' }> & {
      /** The default view when a tool UI is registered, or `null`. */
      readonly toolUI: TemplateRef<unknown> | null;
      /** Adds the tool result for this call. */
      addResult: PartMethods['addToolResult'];
      /** Resumes a tool call waiting for human input. */
      resume: PartMethods['resumeToolCall'];
      /** Responds to a server-side tool approval gate. */
      respondToApproval: PartMethods['respondToToolApproval'];
      /** @deprecated Experimental since 2026-09-23. Not scheduled for removal; the API may change in any release. */
      unstable_recordInteraction?: PartMethods['unstable_recordInteraction'];
    })
  | (Extract<PartState, { type: 'data' }> & {
      /** The default view when a data renderer is registered, or `null`. */
      readonly dataRendererUI: TemplateRef<unknown> | null;
    })
  | Exclude<PartState, { type: 'tool-call' } | { type: 'data' }>;

/**
 * What an `ng-template auiThreadRow` receives (`let-info`), discriminated by
 * `type`, which repeats `row.type` so it narrows the rest.
 */
export type AuiThreadRowInfo =
  | {
      readonly type: 'message';
      readonly row: Extract<ThreadRow, { type: 'message' }>;
      /** The row's message. */
      readonly message: AssistantState['message'];
    }
  | {
      readonly type: 'part';
      readonly row: Extract<ThreadRow, { type: 'part' }>;
      /**
       * A group part for a node that coalesced parts, or the leaf part. The
       * template renders once per node of the row's group subtree, so nested
       * groups wrap their children recursively.
       */
      readonly part: AuiThreadRowGroupPart | AuiThreadRowLeafPart;
      /**
       * For a group, its rendered subtree. For a leaf, the part's default view
       * (its registered tool or data UI, a matching `ng-template auiPart`, or
       * the built-in text rendering). Render it with `ngTemplateOutlet`.
       */
      readonly children: TemplateRef<unknown>;
    }
  | {
      readonly type: 'turn-end';
      /** Carries the turn's `startedAt` and, once it completes, `completedAt`. */
      readonly row: Extract<ThreadRow, { type: 'turn-end' }>;
      /** The turn's last message. */
      readonly message: AssistantState['message'];
    };

/** The context of an `ng-template auiThreadRow`. */
export interface AuiThreadRowTemplateContext {
  /** The row's render info (`let-info`). */
  $implicit: AuiThreadRowInfo;
}

/**
 * Marks the `<ng-template>` that {@link AuiThreadRowComponent} and
 * {@link AuiThreadRowsComponent} render once per row (once per group-subtree
 * node for a part row); its context is {@link AuiThreadRowTemplateContext}.
 */
@Directive({
  selector: 'ng-template[auiThreadRow]',
  standalone: true,
})
export class AuiThreadRowTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<AuiThreadRowTemplateContext>>(TemplateRef);

  /** Types the template context (`let-info`). */
  static ngTemplateContextGuard(
    directive: AuiThreadRowTemplateDirective,
    context: unknown,
  ): context is AuiThreadRowTemplateContext {
    void directive;
    void context;
    return true;
  }
}

type PartRow = Extract<ThreadRow, { type: 'part' }>;

const fallbackNode = (indices: readonly number[]): GroupNode =>
  indices.length === 1
    ? { type: 'part', index: indices[0]!, nodeKey: '0', idKey: undefined }
    : {
        type: 'group',
        key: 'group-row',
        nodeKey: '0',
        idKey: undefined,
        indices,
        children: indices.map((index, position) => ({
          type: 'part' as const,
          index,
          nodeKey: `0.${position}`,
          idKey: undefined,
        })),
      };

/**
 * Internal: renders the row template for one leaf part, inside the part scope.
 */
@Component({
  selector: 'aui-thread-row-leaf',
  standalone: true,
  imports: [NgTemplateOutlet, AuiPartViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #defaultView><aui-part-view [templates]="partTemplates()" /></ng-template>
    <ng-container *ngTemplateOutlet="template(); context: context(defaultView)" />
  `,
})
export class AuiThreadRowLeafComponent {
  /** The part row. */
  readonly row = input.required<PartRow>();
  /** The row template. */
  readonly template = input.required<TemplateRef<AuiThreadRowTemplateContext>>();
  /** Part templates for the default view. */
  readonly partTemplates = input.required<AuiPartTemplates>();

  private readonly aui = injectAui();
  private readonly part = injectAuiState((s) => s.part);
  private readonly registeredTool = injectRegisteredToolView();
  private readonly registeredData = injectRegisteredDataRenderer();
  /**
   * Whether a tool or data UI is registered for the current part, resolved by the same helpers as
   * the default view (`aui-part-view`), so `toolUI` / `dataRendererUI` match what it renders.
   */
  private readonly hasRegisteredUI = computed(
    () => this.registeredTool() !== null || this.registeredData() !== null,
  );

  /** Builds the template context for the current part. */
  protected context(children: TemplateRef<unknown>): AuiThreadRowTemplateContext {
    const state = this.part();
    const ui = this.hasRegisteredUI() ? children : null;
    let part = state as AuiThreadRowLeafPart;
    if (state.type === 'tool-call') {
      const methods = this.aui.part;
      part = {
        ...state,
        toolUI: ui,
        addResult: methods.addToolResult,
        resume: methods.resumeToolCall,
        respondToApproval: methods.respondToToolApproval,
        ...(methods.unstable_recordInteraction && {
          unstable_recordInteraction: methods.unstable_recordInteraction,
        }),
      };
    } else if (state.type === 'data') {
      part = { ...state, dataRendererUI: ui };
    }
    return { $implicit: { type: 'part', row: this.row(), part, children } };
  }
}

/**
 * Internal: renders one node of a part row's group subtree inside the message
 * scope, recursing into group children.
 */
@Component({
  selector: 'aui-thread-row-node',
  standalone: true,
  imports: [NgTemplateOutlet, AuiScopeOutletComponent, AuiThreadRowLeafComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #kids>
      @for (child of children(); track childKey(child)) {
        <aui-thread-row-node
          [node]="child"
          [row]="row()"
          [template]="template()"
          [partTemplates]="partTemplates()"
        />
      }
    </ng-template>
    <ng-template #leaf>
      <aui-thread-row-leaf
        [row]="row()"
        [template]="template()"
        [partTemplates]="partTemplates()"
      />
    </ng-template>
    @if (group(); as group) {
      <ng-container *ngTemplateOutlet="template(); context: groupContext(group, kids)" />
    } @else {
      @if (leafIndex() !== null) {
        <aui-scope-outlet [config]="partConfig(leafIndex()!)" [template]="leaf" />
      }
    }
  `,
})
export class AuiThreadRowNodeComponent {
  /** The group-tree node to render. */
  readonly node = input.required<GroupNode>();
  /** The part row the node belongs to. */
  readonly row = input.required<PartRow>();
  /** The row template. */
  readonly template = input.required<TemplateRef<AuiThreadRowTemplateContext>>();
  /** Part templates for leaf default views. */
  readonly partTemplates = input.required<AuiPartTemplates>();

  private readonly aui = injectAui();
  private readonly parts = injectAuiState((s) => s.message.parts);
  private readonly partConfigs = new Map<number, AuiConfig>();
  private destroyed = false;

  /** The node when it is a group. */
  protected readonly group = computed(() => {
    const node = this.node();
    return node.type === 'group' ? node : null;
  });
  /** The part index when the node is a leaf. */
  protected readonly leafIndex = computed(() => {
    const node = this.node();
    return node.type === 'part' && node.index < this.parts().length ? node.index : null;
  });
  /** The group's child nodes. */
  protected readonly children = computed(() => this.group()?.children ?? []);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.partConfigs.clear();
    });
  }

  /** A stable `@for` key for a child node. */
  protected childKey(child: GroupNode): string {
    return child.type === 'part'
      ? `part-${child.idKey ?? child.index}`
      : JSON.stringify([child.key, child.idKey ?? child.nodeKey]);
  }

  /** Builds the template context for a group node. */
  protected groupContext(
    group: Extract<GroupNode, { type: 'group' }>,
    children: TemplateRef<unknown>,
  ): AuiThreadRowTemplateContext {
    const { status, counts, timing } = getGroupSummary(this.parts(), group.indices);
    const part: AuiThreadRowGroupPart = {
      type: group.key as `group-${string}`,
      status,
      counts,
      indices: group.indices,
      ...(timing && { timing }),
    };
    return { $implicit: { type: 'part', row: this.row(), part, children } };
  }

  /** Returns the memoised scope config for the part at `index`. */
  protected partConfig(index: number): AuiConfig {
    let config = this.partConfigs.get(index);
    if (!config) {
      const aui = this.aui;
      config = partScopeConfig(
        aui,
        index,
        () => !this.destroyed && index < aui.message.getState().parts.length,
      );
      this.partConfigs.set(index, config);
    }
    return config;
  }
}

/**
 * Internal: renders the row template inside the row's message scope.
 */
@Component({
  selector: 'aui-thread-row-view',
  standalone: true,
  imports: [NgTemplateOutlet, AuiThreadRowNodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (partRow(); as partRow) {
      <aui-thread-row-node
        [node]="node(partRow)"
        [row]="partRow"
        [template]="template()"
        [partTemplates]="partTemplates()"
      />
    } @else if (plainRow()) {
      <ng-container *ngTemplateOutlet="template(); context: context()" />
    }
  `,
})
export class AuiThreadRowViewComponent {
  /** The row to render. */
  readonly row = input.required<ThreadRow>();
  /** The row template. */
  readonly template = input.required<TemplateRef<AuiThreadRowTemplateContext>>();
  /** Part templates for leaf default views. */
  readonly partTemplates = input.required<AuiPartTemplates>();

  private readonly message = injectAuiState((s) => s.message);
  private readonly parts = injectAuiState((s) => s.message.parts);

  /** The row when it is a part row whose parts still exist. */
  protected readonly partRow = computed<PartRow | null>(() => {
    const row = this.row();
    if (row.type !== 'part') return null;
    // A row can outlive its parts for a frame (a virtualizer): render nothing.
    return row.indices.every((index) => index < this.parts().length) ? row : null;
  });

  /** The row when it is a message or turn-end row. */
  protected readonly plainRow = computed(() => {
    const row = this.row();
    return row.type === 'part' ? null : row;
  });

  /** The group subtree of a part row. */
  protected node(row: PartRow): GroupNode {
    return getThreadRowNode(row) ?? fallbackNode(row.indices);
  }

  /** Builds the template context for a message or turn-end row. */
  protected context(): AuiThreadRowTemplateContext {
    const row = this.plainRow()!;
    return { $implicit: { type: row.type, row, message: this.message() } as AuiThreadRowInfo };
  }
}

const mergeTemplates = (
  explicit: AuiPartTemplates | undefined,
  projected: readonly AuiPartTemplateDirective[],
): AuiPartTemplates => {
  const map = new Map<string, TemplateRef<AuiPartTemplateContext>>();
  for (const directive of projected) {
    if (!map.has(directive.auiPart())) map.set(directive.auiPart(), directive.templateRef);
  }
  if (explicit)
    for (const [type, template] of explicit) if (!map.has(type)) map.set(type, template);
  return map;
};

/**
 * Renders one {@link ThreadRow} of a flattened thread (from
 * {@link createThreadRowsSelector}), mounting only the scopes that row needs:
 * its message, and for a part row only that row's parts. A row whose message
 * or parts are gone (a virtualizer can render a row for a frame after it left
 * the thread) renders nothing. Adds no box of its own.
 *
 * @example
 * ```html
 * <aui-thread-row [row]="row">
 *   <ng-template auiThreadRow let-info>
 *     @switch (info.type) {
 *       @case ('message') { <app-message /> }
 *       @case ('part') { <ng-container *ngTemplateOutlet="info.children" /> }
 *       @case ('turn-end') { <app-turn-footer [row]="info.row" /> }
 *     }
 *   </ng-template>
 * </aui-thread-row>
 * ```
 */
@Component({
  selector: 'aui-thread-row',
  standalone: true,
  imports: [AuiScopeOutletComponent, AuiThreadRowViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #view>
      @if (resolvedTemplate(); as template) {
        <aui-thread-row-view
          [row]="row()"
          [template]="template"
          [partTemplates]="resolvedPartTemplates()"
        />
      }
    </ng-template>
    @if (exists()) {
      <aui-scope-outlet [config]="messageConfig()" [template]="view" />
    }
  `,
})
export class AuiThreadRowComponent {
  /** A row from {@link createThreadRowsSelector}. */
  readonly row = input.required<ThreadRow>();
  /** The row template; defaults to the projected `ng-template auiThreadRow`. */
  readonly template = input<TemplateRef<AuiThreadRowTemplateContext> | undefined>(undefined);
  /** Part templates for a part row's `children`, merged with projected `ng-template auiPart`s. */
  readonly partTemplates = input<AuiPartTemplates | undefined>(undefined);

  private readonly projectedTemplate = contentChild(AuiThreadRowTemplateDirective);
  private readonly projectedPartTemplates = contentChildren(AuiPartTemplateDirective);
  private readonly aui = injectAui();
  private readonly messageId = computed(() => this.row().messageId);
  private destroyed = false;

  /** The template to render. */
  protected readonly resolvedTemplate = computed(
    () => this.template() ?? this.projectedTemplate()?.templateRef,
  );
  /** The part templates to render `children` with. */
  protected readonly resolvedPartTemplates = computed(() =>
    mergeTemplates(this.partTemplates(), this.projectedPartTemplates()),
  );
  /** False once the row's message left the thread. */
  protected readonly exists = injectAuiState((s) =>
    s.thread.messages.some((message) => message.id === this.messageId()),
  );
  /** The message scope of the row; stable while the message id is. */
  protected readonly messageConfig = computed(() => {
    const id = this.messageId();
    const aui = this.aui;
    return messageScopeConfig(aui, id, () => !this.destroyed && hasMessage(aui, id));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });
  }
}

/**
 * Renders every row of the current thread through the projected
 * `ng-template auiThreadRow`, keyed by `row.key`. The rows come from one
 * {@link createThreadRowsSelector} per list, so a streamed token that leaves
 * the rows unchanged does not re-render them. For a virtualized list, create
 * the selector yourself, read it with `injectAuiState` and render each
 * visible row with `aui-thread-row`.
 *
 * @example
 * ```html
 * <aui-thread-rows>
 *   <ng-template auiThreadRow let-info>…</ng-template>
 * </aui-thread-rows>
 * ```
 */
@Component({
  selector: 'aui-thread-rows',
  standalone: true,
  imports: [AuiThreadRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (row of rows(); track row.key) {
      <aui-thread-row
        [row]="row"
        [template]="rowTemplate().templateRef"
        [partTemplates]="partTemplateMap()"
      />
    }
  `,
})
export class AuiThreadRowsComponent {
  /** Options for the rows selector, e.g. `groupBy`. Keep the object identity stable. */
  readonly options = input<ThreadRowsOptions>({});

  /** The projected per-row template. */
  protected readonly rowTemplate = contentChild.required(AuiThreadRowTemplateDirective);
  private readonly projectedPartTemplates = contentChildren(AuiPartTemplateDirective);
  /** Projected `ng-template auiPart`s, forwarded to every row. */
  protected readonly partTemplateMap = computed(() =>
    mergeTemplates(undefined, this.projectedPartTemplates()),
  );

  // One selector per list; it is recreated only when `options` changes.
  private readonly selector = computed(() => createThreadRowsSelector(this.options()));
  /** The flattened rows of the current thread. */
  protected readonly rows = injectAuiState((s) => this.selector()(s));
}
