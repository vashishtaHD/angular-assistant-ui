// Ported from packages/core/src/react/primitives/composer/ComposerQueue.tsx @ 7d74276
// and packages/react/src/primitives/queueItem/{QueueItemText,QueueItemSteer,QueueItemRemove}.ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  contentChild,
  inject,
} from '@angular/core';
import type { AuiConfig } from '@assistant-ui/store/client';
import { indexScopeConfig } from '../scope/index-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { stableKeys } from '../scope/stable-keys';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';

/**
 * Marks the `<ng-template>` that {@link AuiComposerQueueComponent} renders
 * once per queued message.
 */
@Directive({
  selector: 'ng-template[auiQueueItem]',
  standalone: true,
})
export class AuiQueueItemTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * Renders the projected `ng-template auiQueueItem` once per message waiting in
 * the composer queue, each instance scoped to its queue item (descendants read
 * it through `s.queueItem`) and keyed by the item id. Adds no box of its own.
 *
 * @example
 * ```html
 * <aui-composer-queue>
 *   <ng-template auiQueueItem>
 *     <span auiQueueItemText></span>
 *     <button auiQueueItemSteer>Run now</button>
 *     <button auiQueueItemRemove>×</button>
 *   </ng-template>
 * </aui-composer-queue>
 * ```
 */
@Component({
  selector: 'aui-composer-queue',
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
export class AuiComposerQueueComponent {
  /** The projected per-item template. */
  protected readonly itemTemplate = contentChild.required(AuiQueueItemTemplateDirective);

  private readonly aui = injectAui();
  private readonly queue = injectAuiState((s) => s.composer.queue);
  /** The queue item ids, stable while they keep the same order. */
  protected readonly ids = stableKeys(() => this.queue().map((item) => item.id));

  private readonly configs = new Map<string, { index: number; config: AuiConfig }>();
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.configs.clear();
    });
  }

  /** Returns the memoised scope config for the item `id` at `index`. */
  protected configFor(id: string, index: number): AuiConfig {
    const live = new Set(this.ids());
    for (const key of this.configs.keys()) if (!live.has(key)) this.configs.delete(key);
    const cached = this.configs.get(id);
    if (cached?.index === index) return cached.config;
    const aui = this.aui;
    const config = indexScopeConfig(
      'queueItem',
      aui,
      index,
      () => !this.destroyed && aui.composer.getState().queue[index]?.id === id,
    );
    this.configs.set(id, { index, config });
    return config;
  }
}
