// Ported from packages/vue/src/primitives/AttachmentByIndexProvider.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// Also generalises suggestions.ts and threadList.ts in the same directory:
// (the ByIndex providers) the same way message-scope.ts / part-scope.ts port MessageById / PartByIndex.
import { AuiConfig, Derived, type AssistantClient } from '@assistant-ui/store/client';
import type { MessageState } from '@assistant-ui/core/store';
import { createLastValidCache, createStaleReporter } from './last-valid-cache';

/** The by-index child scopes {@link indexScopeConfig} can build. */
export type IndexScopeKind = 'attachment' | 'suggestion' | 'threadListItem' | 'queueItem';

/** Where an `attachment` scope's attachments live. */
export type AttachmentScopeSource = 'composer' | 'message';

/** Extra options for the kinds that need them. */
export interface IndexScopeOptions {
  /** `attachment` only (required there): the composer's or the message's attachments. */
  source?: AttachmentScopeSource;
  /** `threadListItem` only: index into `archivedThreadIds` instead of `threadIds`. */
  archived?: boolean;
}

const attachmentCount = (aui: AssistantClient, source: AttachmentScopeSource): number => {
  if (source === 'composer') return aui.composer.getState().attachments?.length ?? 0;
  const state: MessageState = aui.message.getState();
  return (state.submission?.attachments ?? state.attachments)?.length ?? 0;
};

const requireSource = (options: IndexScopeOptions): AttachmentScopeSource => {
  if (!options.source) throw new Error("indexScopeConfig('attachment') needs options.source.");
  return options.source;
};

/**
 * How many items the collection behind an index scope currently holds. An
 * index below this is valid. Owners use it for the same bound the scope uses.
 */
export function indexScopeCount(
  kind: IndexScopeKind,
  aui: AssistantClient,
  options: IndexScopeOptions = {},
): number {
  switch (kind) {
    case 'attachment':
      return attachmentCount(aui, requireSource(options));
    case 'suggestion':
      return aui.suggestions.getState().suggestions.length;
    case 'threadListItem': {
      const state = aui.threads.getState();
      return (options.archived ? state.archivedThreadIds : state.threadIds).length;
    }
    case 'queueItem':
      return aui.composer.getState().queue.length;
  }
}

/**
 * The scope config for the child at `index` of the collection `kind` names.
 * Descendants read it through `s.attachment`, `s.suggestion`,
 * `s.threadListItem` or `s.queueItem`. Render it with
 * `AuiScopeOutletComponent`, keyed by a stable id. (Chain of thought parts
 * use their own config, `chainPartConfig` in `chain-of-thought/parts.ts`.)
 *
 * `aui` is the parent client that owns the collection: the thread (or any
 * descendant) for suggestions, the composer scope for composer attachments
 * and queue items, the message scope for message attachments, and the root
 * for thread list items. `isCurrent`
 * reports whether the owner still targets `index`; after the collection
 * shrinks the scope serves the last valid item for one microtask, then
 * reports once if the owner still points past the end.
 */
export function indexScopeConfig(
  kind: 'attachment',
  aui: AssistantClient,
  index: number,
  isCurrent: () => boolean,
  options: IndexScopeOptions & { source: AttachmentScopeSource },
): AuiConfig;
export function indexScopeConfig(
  kind: Exclude<IndexScopeKind, 'attachment'>,
  aui: AssistantClient,
  index: number,
  isCurrent: () => boolean,
  options?: IndexScopeOptions,
): AuiConfig;
export function indexScopeConfig(
  kind: IndexScopeKind,
  aui: AssistantClient,
  index: number,
  isCurrent: () => boolean,
  options: IndexScopeOptions = {},
): AuiConfig {
  const isValid = () => index < indexScopeCount(kind, aui, options);
  const reporter = (name: string) => createStaleReporter({ name, index, isCurrent, isValid });
  switch (kind) {
    case 'attachment': {
      const source = requireSource(options);
      const cache = createLastValidCache<ReturnType<AssistantClient['composer']['attachment']>>(
        reporter('AttachmentByIndexProvider'),
      );
      return AuiConfig({
        attachment: Derived({
          source,
          query: { type: 'index', index },
          get: (parent) =>
            cache.resolve(index < attachmentCount(parent, source), () =>
              (source === 'composer' ? parent.composer : parent.message).attachment({ index }),
            ),
        }),
      });
    }
    case 'suggestion': {
      const cache = createLastValidCache<ReturnType<AssistantClient['suggestions']['suggestion']>>(
        reporter('SuggestionByIndexProvider'),
      );
      return AuiConfig({
        suggestion: Derived({
          source: 'suggestions',
          query: { index },
          get: (parent) =>
            cache.resolve(index < indexScopeCount('suggestion', parent), () =>
              parent.suggestions.suggestion({ index }),
            ),
        }),
      });
    }
    case 'threadListItem': {
      const archived = options.archived ?? false;
      const cache = createLastValidCache<ReturnType<AssistantClient['threads']['item']>>(
        reporter('ThreadListItemByIndexProvider'),
      );
      return AuiConfig({
        threadListItem: Derived({
          source: 'threads',
          query: { type: 'index', index, archived },
          get: (parent) =>
            cache.resolve(index < indexScopeCount('threadListItem', parent, { archived }), () =>
              parent.threads.item({ index, archived }),
            ),
        }),
      });
    }
    case 'queueItem': {
      const cache = createLastValidCache<ReturnType<AssistantClient['composer']['queueItem']>>(
        reporter('QueueItemByIndexProvider'),
      );
      return AuiConfig({
        queueItem: Derived({
          source: 'composer',
          query: { type: 'index', index },
          get: (parent) =>
            cache.resolve(index < indexScopeCount('queueItem', parent), () =>
              parent.composer.queueItem({ index }),
            ),
        }),
      });
    }
  }
}
