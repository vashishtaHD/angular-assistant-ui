// Ported from packages/vue/src/primitives/ChainOfThoughtPrimitiveParts.ts @ 7d74276
// and packages/core/src/react/primitives/chainOfThought/ChainOfThoughtParts.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  contentChildren,
  inject,
} from '@angular/core';
import { getMessagePartKeys } from '@assistant-ui/core/internal';
import { AuiConfig, Derived, type AssistantClient } from '@assistant-ui/store/client';
import { AuiScopeOutletComponent } from '../../scope/scope-outlet.component';
import { stableKeys } from '../../scope/stable-keys';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiPartTemplateDirective } from '../message-parts.component';
import {
  AuiPartViewComponent,
  type AuiPartTemplateContext,
  type AuiPartTemplates,
} from '../part-view.component';

/**
 * The part scope of the chain's part at `index`. It follows the shape of
 * `indexScopeConfig('chainOfThoughtPart')`, but keeps its own last valid part
 * for the row's whole life: a row whose part just left the chain is still
 * evaluated after change detection has not yet removed it, and must neither
 * throw nor show another part. Lookups of a part that never existed still
 * throw (upstream's out-of-bounds error).
 */
const chainPartConfig = (index: number): AuiConfig => {
  let last: ReturnType<AssistantClient['chainOfThought']['part']> | undefined;
  return AuiConfig({
    part: Derived({
      source: 'chainOfThought',
      query: { type: 'index', index },
      get: (parent) => {
        if (index < parent.chainOfThought.getState().parts.length) {
          try {
            last = parent.chainOfThought.part({ index });
            return last;
          } catch {
            // The chain moved on between the state read and the lookup.
          }
        }
        if (last) return last;
        return parent.chainOfThought.part({ index });
      },
    }),
  });
};

interface Entry {
  index: number;
  config: AuiConfig;
}

/**
 * Renders the parts of the enclosing chain of thought (`reasoning` and
 * `tool-call` parts), each in its own part scope, one per entry of
 * `s.chainOfThought.parts`. Part templates are `ng-template auiPart` children
 * (`reasoning`, `tool-call`, `default`); tool UIs registered in the `tools`
 * scope still win for tool calls.
 *
 * Rendering is not gated on `s.chainOfThought.collapsed`, matching upstream:
 * gate visibility in the caller (for example with `@if`).
 *
 * @example
 * ```html
 * <aui-chain-of-thought-parts>
 *   <ng-template auiPart="reasoning" let-part>{{ part.type === 'reasoning' ? part.text : '' }}</ng-template>
 * </aui-chain-of-thought-parts>
 * ```
 */
@Component({
  selector: 'aui-chain-of-thought-parts',
  standalone: true,
  imports: [AuiScopeOutletComponent, AuiPartViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #partView><aui-part-view [templates]="templateMap()" /></ng-template>
    @for (key of keys(); track key) {
      <aui-scope-outlet [config]="configFor(key, $index)" [template]="partView" />
    }
  `,
})
export class AuiChainOfThoughtPartsComponent {
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

  private readonly parts = injectAuiState((s) => s.chainOfThought.parts);
  /** The part keys, stable while they keep the same order. */
  protected readonly keys = stableKeys(() => getMessagePartKeys(this.parts()));

  private readonly entries = new Map<string, Entry>();
  private prunedFor: readonly string[] | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.entries.clear();
    });
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
    const entry: Entry = { index, config: chainPartConfig(index) };
    this.entries.set(key, entry);
    return entry.config;
  }
}
