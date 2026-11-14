// Ported from packages/vue/src/primitives/lastValidCache.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  createLastValidCache as createNeutralLastValidCache,
  createStaleReporter,
} from '@assistant-ui/store/client';

// Vue expires on `nextTick`; a microtask is the Angular "after the current
// flush". Rows are removed later than that (on change detection), so scope
// owners pass an `isCurrent` that consults the live collection.
const scheduleExpiry = (callback: () => void) => queueMicrotask(callback);

/**
 * Creates upstream's neutral last-valid cache with a microtask expiry: it
 * serves the last valid scope item for the window between a collection
 * shrink and the row's removal, then drops the cache and calls `reportStale`
 * (once) if the scope is still out of bounds. Pass `null` when a sibling
 * cache over the same validity predicate already reports.
 */
export const createLastValidCache = <T>(reportStale: (() => void) | null) =>
  createNeutralLastValidCache<T>(reportStale, scheduleExpiry);

export { createStaleReporter };
