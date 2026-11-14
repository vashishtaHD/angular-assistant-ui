// Ported from packages/vue/src/AuiProvider.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (the `extends` path used by MessageByIdProvider and PartByIndexProvider)
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  TemplateRef,
  inject,
  input,
  untracked,
  type OnChanges,
} from '@angular/core';
import type { AuiConfig } from '@assistant-ui/store/client';
import { AUI_CONTEXT, injectAuiContext } from '../context/aui-context';
import { createAuiContext, type CreatedAuiContext } from '../context/create-aui-context';

/**
 * Internal: renders `template` inside a child scope that extends the nearest
 * provider with `config`. Each instance owns its child client and releases it
 * on destroy. The template is rendered with an explicit injector so its
 * descendants resolve this scope's context rather than the one at the
 * template's declaration site.
 */
@Component({
  selector: 'aui-scope-outlet',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<ng-container *ngTemplateOutlet="template(); injector: scopeInjector" />`,
})
export class AuiScopeOutletComponent implements OnChanges {
  /** The child scope's config; binding a new object updates it in place. */
  readonly config = input.required<AuiConfig>();
  /** The template rendered inside the scope. */
  readonly template = input.required<TemplateRef<unknown>>();

  private readonly parent = injectAuiContext().source;
  private readonly injector = inject(Injector);
  private readonly configListeners = new Set<() => void>();
  private inner: CreatedAuiContext | undefined;

  /** The injector the template renders with; set on the first change. */
  protected scopeInjector: Injector | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.configListeners.clear();
      this.inner?.release();
    });
  }

  /** Creates the scope on the first run; afterwards forwards config changes. */
  ngOnChanges(): void {
    if (!this.inner) {
      this.inner = createAuiContext({
        parent: this.parent,
        getConfig: () => untracked(() => this.config()),
        subscribe: (listener) => {
          this.configListeners.add(listener);
          return () => {
            this.configListeners.delete(listener);
          };
        },
      });
      this.scopeInjector = Injector.create({
        providers: [{ provide: AUI_CONTEXT, useValue: this.inner.context }],
        parent: this.injector,
      });
      return;
    }
    for (const listener of [...this.configListeners]) listener();
  }
}
