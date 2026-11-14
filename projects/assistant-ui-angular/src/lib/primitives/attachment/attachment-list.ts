// Ported from packages/vue/src/primitives/{composerAttachments,messageAttachments,AttachmentByIndexProvider}.ts
// @ 7d7427653f6ba47b0b954510eed9c594d64e74d5 (the shared list; the two public components differ in `source`)
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  Injector,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
} from '@angular/core';
import type { AssistantClient, AssistantState, AuiConfig } from '@assistant-ui/store/client';
import {
  indexScopeConfig,
  indexScopeCount,
  type AttachmentScopeSource,
} from '../../scope/index-scope';
import { stableKeys } from '../../scope/stable-keys';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';

/** The context of an `ng-template auiAttachment`: the current attachment state. */
export interface AuiAttachmentTemplateContext {
  /** The attachment this template instance renders (`let-attachment`). */
  $implicit: AssistantState['attachment'];
}

/**
 * Marks an `<ng-template>` that an attachment list renders for each
 * attachment. `auiAttachment="image"`, `"document"` or `"file"` limits it to
 * that attachment type; a bare `auiAttachment` is the fallback for every type
 * without its own template. It renders inside the attachment's scope, so
 * `[auiAttachmentRoot]`, `aui-attachment-name` and the other attachment
 * primitives work in it.
 *
 * @example
 * ```html
 * <aui-composer-attachments>
 *   <ng-template auiAttachment let-attachment>
 *     <div auiAttachmentRoot>
 *       <aui-attachment-name />
 *       <button auiAttachmentRemove>x</button>
 *     </div>
 *   </ng-template>
 * </aui-composer-attachments>
 * ```
 */
@Directive({
  selector: 'ng-template[auiAttachment]',
  standalone: true,
})
export class AuiAttachmentTemplateDirective {
  /** The attachment type this template renders; empty for the fallback. */
  readonly auiAttachment = input<string>('');
  /** The marked template. */
  readonly templateRef = inject<TemplateRef<AuiAttachmentTemplateContext>>(TemplateRef);

  /** Types the template context (`let-attachment`) as the current attachment state. */
  static ngTemplateContextGuard(
    directive: AuiAttachmentTemplateDirective,
    context: unknown,
  ): context is AuiAttachmentTemplateContext {
    void directive;
    void context;
    return true;
  }
}

/** Internal: renders the template matching the scoped attachment's type. */
@Component({
  selector: 'aui-attachment-view',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (template(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl; context: context(); injector: injector" />
    }
  `,
})
export class AuiAttachmentViewComponent {
  /** The type-keyed templates of the owning list. */
  readonly templates =
    input.required<ReadonlyMap<string, TemplateRef<AuiAttachmentTemplateContext>>>();

  /** Renders the template in this attachment's scope. */
  protected readonly injector = inject(Injector);
  private readonly attachment = injectAuiState((s) => s.attachment);

  /** @internal */
  protected readonly template = computed(() => {
    const templates = this.templates();
    return templates.get(this.attachment().type) ?? templates.get('');
  });
  /** @internal */
  protected readonly context = computed<AuiAttachmentTemplateContext>(() => ({
    $implicit: this.attachment(),
  }));
}

/** Stable keys for an attachment list: ids, or the index when an id repeats. */
export const getAttachmentKeys = (attachments: readonly { readonly id: string }[]): string[] => {
  const ids = attachments.map((attachment) => attachment.id);
  return ids.map((id, index) =>
    ids.indexOf(id) === ids.lastIndexOf(id) ? `attachment:${id}` : `attachment@${index}`,
  );
};

interface Entry {
  index: number;
  config: AuiConfig;
}

/** Internal: the logic both attachment lists share. */
@Directive()
export abstract class AuiAttachmentListBase {
  private readonly directives = contentChildren(AuiAttachmentTemplateDirective);

  /** Projected templates by attachment type; the first for a type wins. */
  protected readonly templateMap = computed(() => {
    const map = new Map<string, TemplateRef<AuiAttachmentTemplateContext>>();
    for (const directive of this.directives()) {
      const type = directive.auiAttachment();
      if (!map.has(type)) map.set(type, directive.templateRef);
    }
    return map;
  });

  private readonly aui = injectAui();
  private readonly entries = new Map<string, Entry>();
  private prunedFor: readonly string[] | undefined;
  private destroyed = false;

  /** @internal */
  protected abstract readonly source: AttachmentScopeSource;
  /** @internal */
  protected abstract readonly attachments: () => readonly { readonly id: string }[];
  /** The attachment keys, stable while they keep the same order. */
  protected readonly keys = stableKeys(() => getAttachmentKeys(this.attachments()));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.entries.clear();
    });
  }

  /** Returns the memoised scope config for the attachment `key` at `index`. */
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
    const aui: AssistantClient = this.aui;
    const source = this.source;
    const has = () => {
      try {
        return index < indexScopeCount('attachment', aui, { source });
      } catch {
        // The owning scope is gone (its row is being torn down).
        return false;
      }
    };
    const entry: Entry = {
      index,
      // "Current" consults the live collection (as for message parts), so the
      // stale diagnostic stays silent for rows change detection is removing.
      config: indexScopeConfig(
        'attachment',
        aui,
        index,
        () => !this.destroyed && this.entries.get(key) === entry && has(),
        { source },
      ),
    };
    this.entries.set(key, entry);
    return entry.config;
  }
}
