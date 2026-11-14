// Ported from packages/core/src/react/primitives/thread/ThreadRow.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (selector and types: packages/core/src/react/utils/threadRows.ts, re-exported from @assistant-ui/core/react)
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
import {
  createThreadRowsSelector,
  type ThreadRow,
  type ThreadRowsOptions,
} from '@assistant-ui/core/react';
import type { AssistantState, AuiConfig } from '@assistant-ui/store/client';
import { hasMessage, messageScopeConfig } from '../scope/message-scope';
import { partScopeConfig } from '../scope/part-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiPartTemplateDirective } from './message-parts.component';
import {
  AuiPartViewComponent,
  type AuiPartTemplateContext,
  type AuiPartTemplates,
} from './part-view.component';

export { createThreadRowsSelector, type ThreadRow, type ThreadRowsOptions };

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
      /** The row's parts, in order (one part, or the parts a group coalesced). */
      readonly parts: readonly AssistantState['message']['parts'][number][];
      /**
       * Renders the row's parts, each in its own part scope, using the
       * `ng-template auiPart` templates given to the row or to `aui-thread-rows`.
       * Render it with `ngTemplateOutlet`.
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
 * {@link AuiThreadRowsComponent} render once per row; its context is
 * {@link AuiThreadRowTemplateContext}.
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

/**
 * Internal: renders the row template inside the row's message scope.
 */
@Component({
  selector: 'aui-thread-row-view',
  standalone: true,
  imports: [NgTemplateOutlet, AuiScopeOutletComponent, AuiPartViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #children>
      @for (index of partIndices(); track index) {
        <aui-scope-outlet [config]="partConfig(index)" [template]="partView" />
      }
    </ng-template>
    <ng-template #partView><aui-part-view [templates]="partTemplates()" /></ng-template>
    @if (present()) {
      <ng-container *ngTemplateOutlet="template(); context: context(children)" />
    }
  `,
})
export class AuiThreadRowViewComponent {
  /** The row to render. */
  readonly row = input.required<ThreadRow>();
  /** The row template. */
  readonly template = input.required<TemplateRef<AuiThreadRowTemplateContext>>();
  /** Part templates for `children`. */
  readonly partTemplates = input.required<AuiPartTemplates>();

  private readonly aui = injectAui();
  private readonly message = injectAuiState((s) => s.message);
  private readonly parts = injectAuiState((s) => s.message.parts);
  private readonly partConfigs = new Map<number, AuiConfig>();
  private destroyed = false;

  /** Part indices of a part row, else none. */
  protected readonly partIndices = computed<readonly number[]>(() => {
    const row = this.row();
    return row.type === 'part' ? row.indices : [];
  });

  /** False when a part row's parts are gone (a row can outlive its parts for a frame). */
  protected readonly present = computed(() => {
    const row = this.row();
    return row.type !== 'part' || row.indices.every((index) => index < this.parts().length);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.partConfigs.clear();
    });
  }

  /** Builds the template context for the current row. */
  protected context(children: TemplateRef<unknown>): AuiThreadRowTemplateContext {
    const row = this.row();
    if (row.type === 'part') {
      const parts = this.parts();
      return {
        $implicit: {
          type: 'part',
          row,
          parts: row.indices.map((index) => parts[index]).filter((part) => part !== undefined),
          children,
        },
      };
    }
    return { $implicit: { type: row.type, row, message: this.message() } as AuiThreadRowInfo };
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
