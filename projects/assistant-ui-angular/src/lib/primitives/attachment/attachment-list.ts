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

/** The ids and keys of an attachment list's previous render. */
export interface AttachmentKeyState {
  readonly ids: readonly string[];
  readonly keys: readonly string[];
}

/**
 * Keys for `ids` that carry over from `previous`: a kept id keeps its key, and with `handoff` a
 * new id keeps the key of the previous attachment at its index when that attachment's id left
 * the list. That is a message's send handoff, where the host acknowledges the in-flight
 * submission and replaces every attachment id, so the rows (DOM, components, scopes) are updated
 * in place instead of re-created (which Angular reports as NG0956 for a whole list). Rows are
 * index-scoped, so a kept row shows the attachment now at its index.
 */
export const carryAttachmentKeys = (
  ids: readonly string[],
  previous: AttachmentKeyState,
  handoff: boolean,
): string[] => {
  const fresh = getAttachmentKeys(ids.map((id) => ({ id })));
  const keys = ids.map((id, index) => {
    if (!fresh[index]!.startsWith('attachment:')) return fresh[index]!;
    const kept = previous.ids.indexOf(id);
    if (kept !== -1 && previous.ids.lastIndexOf(id) === kept) return previous.keys[kept]!;
    const old = previous.ids[index];
    if (handoff && old !== undefined && !ids.includes(old)) return previous.keys[index]!;
    return fresh[index]!;
  });
  // Never hand out a key twice; a clash falls back to the id key, then to the index.
  const used = new Set<string>();
  return keys.map((key, index) => {
    const unique =
      [key, fresh[index]!, `attachment#${index}`].find((candidate) => !used.has(candidate)) ??
      `attachment#${index}`;
    used.add(unique);
    return unique;
  });
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
  /**
   * Whether a wholesale id change is a handoff that keeps the rows (see
   * {@link carryAttachmentKeys}). The message list sets it; the composer list does not.
   */
  protected readonly handoff: boolean = false;
  private previousKeys: AttachmentKeyState = { ids: [], keys: [] };
  /** The attachment keys, stable while they keep the same order. */
  protected readonly keys = stableKeys(() => {
    const ids = this.attachments().map((attachment) => attachment.id);
    const keys = carryAttachmentKeys(ids, this.previousKeys, this.handoff);
    this.previousKeys = { ids, keys };
    return keys;
  });

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
