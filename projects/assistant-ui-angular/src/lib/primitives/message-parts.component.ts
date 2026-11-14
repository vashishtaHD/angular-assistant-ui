// Ported from packages/vue/src/primitives/MessagePrimitiveParts.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
} from '@angular/core';
import { getMessagePartKeys } from '@assistant-ui/core/internal';
import type { AssistantClient, AuiConfig } from '@assistant-ui/store/client';
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

  private readonly entries = new Map<string, PartEntry>();
  private prunedFor: readonly string[] | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
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
