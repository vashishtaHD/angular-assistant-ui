// Ported from packages/vue/src/primitives/threadList.ts (ThreadListPrimitiveItems) @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  booleanAttribute,
  contentChild,
  inject,
  input,
} from '@angular/core';
import type { AuiConfig } from '@assistant-ui/store/client';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { indexScopeConfig } from '../../scope/index-scope';
import { AuiScopeOutletComponent } from '../../scope/scope-outlet.component';
import { stableKeys } from '../../scope/stable-keys';

/**
 * Marks the `<ng-template>` that {@link AuiThreadListItemsComponent} renders
 * once per thread.
 */
@Directive({
  selector: 'ng-template[auiThreadListItem]',
  standalone: true,
})
export class AuiThreadListItemTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * Renders the projected `ng-template auiThreadListItem` once per thread (or
 * per archived thread with `archived`), each instance scoped to its thread
 * list item (descendants read it through `s.threadListItem`) and keyed by the
 * thread id. Adds no box of its own (`display: contents`).
 *
 * @example
 * ```html
 * <aui-thread-list-items>
 *   <ng-template auiThreadListItem><app-thread-row /></ng-template>
 * </aui-thread-list-items>
 * ```
 */
@Component({
  selector: 'aui-thread-list-items',
  standalone: true,
  imports: [AuiScopeOutletComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (id of ids(); track id; let index = $index) {
      <aui-scope-outlet [config]="configFor(id, index)" [template]="itemTemplate().templateRef" />
    }
  `,
})
export class AuiThreadListItemsComponent {
  /** Render the archived threads instead of the regular ones. */
  readonly archived = input(false, { transform: booleanAttribute });

  /** The projected per-item template. */
  protected readonly itemTemplate = contentChild.required(AuiThreadListItemTemplateDirective);

  private readonly aui = injectAui();
  private readonly regular = injectAuiState((s) => s.threads.threadIds);
  private readonly archivedIds = injectAuiState((s) => s.threads.archivedThreadIds);
  /** The thread ids, stable while they keep the same order. */
  protected readonly ids = stableKeys(() => [
    ...(this.archived() ? this.archivedIds() : this.regular()),
  ]);

  private readonly configs = new Map<string, AuiConfig>();
  private prunedFor: readonly string[] | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.configs.clear();
    });
  }

  /** Returns the memoised scope config for the thread `id` at `index`. */
  protected configFor(id: string, index: number): AuiConfig {
    const ids = this.ids();
    const archived = this.archived();
    if (ids !== this.prunedFor) {
      this.prunedFor = ids;
      const live = new Set(ids.map((key, i) => `${archived}:${key}@${i}`));
      for (const key of this.configs.keys()) {
        if (!live.has(key)) this.configs.delete(key);
      }
    }
    const slot = `${archived}:${id}@${index}`;
    let config = this.configs.get(slot);
    if (!config) {
      config = indexScopeConfig(
        'threadListItem',
        this.aui,
        index,
        () => !this.destroyed && this.ids()[index] === id,
        { archived },
      );
      this.configs.set(slot, config);
    }
    return config;
  }
}
