// Ported from packages/vue/src/primitives/suggestions.ts @ 7d74276
// (ThreadPrimitiveSuggestions + SuggestionByIndexProvider; React: packages/react/src/primitives/thread/ThreadSuggestions.tsx)
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
import { getSuggestionKeys } from '@assistant-ui/core/internal';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { indexScopeConfig } from '../scope/index-scope';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { stableKeys } from '../scope/stable-keys';

/**
 * Marks the `<ng-template>` that {@link AuiThreadSuggestionsComponent} renders
 * once per suggestion.
 */
@Directive({
  selector: 'ng-template[auiSuggestion]',
  standalone: true,
})
export class AuiSuggestionTemplateDirective {
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * Renders the projected `ng-template auiSuggestion` once per thread
 * suggestion, each instance scoped to its suggestion (descendants read it
 * through `s.suggestion`). A suggestion's identity is its content, so an
 * unchanged suggestion keeps its row across updates. Adds no box of its own.
 *
 * @example
 * ```html
 * <aui-thread-suggestions>
 *   <ng-template auiSuggestion>
 *     <button auiSuggestionTrigger send><aui-suggestion-title /></button>
 *   </ng-template>
 * </aui-thread-suggestions>
 * ```
 */
@Component({
  selector: 'aui-thread-suggestions',
  standalone: true,
  imports: [AuiScopeOutletComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (key of keys(); track key; let index = $index) {
      <aui-scope-outlet
        [config]="configFor(key, index)"
        [template]="suggestionTemplate().templateRef"
      />
    }
  `,
})
export class AuiThreadSuggestionsComponent {
  /** The projected per-suggestion template. */
  protected readonly suggestionTemplate = contentChild.required(AuiSuggestionTemplateDirective);

  private readonly aui = injectAui();
  private readonly suggestions = injectAuiState((s) => s.suggestions.suggestions);
  /** The suggestion keys, stable while they keep the same order. */
  protected readonly keys = stableKeys(() => getSuggestionKeys(this.suggestions()));

  private readonly configs = new Map<string, { index: number; config: AuiConfig }>();
  private prunedFor: readonly string[] | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.configs.clear();
    });
  }

  /** Returns the memoised scope config for the suggestion `key` at `index`. */
  protected configFor(key: string, index: number): AuiConfig {
    const keys = this.keys();
    if (keys !== this.prunedFor) {
      this.prunedFor = keys;
      const live = new Set(keys);
      for (const k of this.configs.keys()) {
        if (!live.has(k)) this.configs.delete(k);
      }
    }
    let entry = this.configs.get(key);
    if (!entry || entry.index !== index) {
      entry = {
        index,
        config: indexScopeConfig(
          'suggestion',
          this.aui,
          index,
          () => !this.destroyed && this.keys()[index] === key,
        ),
      };
      this.configs.set(key, entry);
    }
    return entry.config;
  }
}
