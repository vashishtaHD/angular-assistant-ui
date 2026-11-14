// Ported from packages/react/src/unstable/useLiveCompletionAdapter.ts @ 7d74276
import {
  DestroyRef,
  assertInInjectionContext,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import type { TriggerAdapter, TriggerItem } from '@assistant-ui/core';

/** @deprecated Experimental since 2026-06-15. Not scheduled for removal; the API may change in any release. */
export interface Unstable_UseLiveCompletionAdapterOptions {
  /**
   * Fetches the items for a query from an async source. Called debounced; the
   * resolved items are cached and returned synchronously to the popover.
   */
  readonly fetcher: (query: string) => Promise<readonly TriggerItem[]>;
  /**
   * Identifies the fetcher's data source. Change it when switching accounts,
   * workspaces, or another boundary that should invalidate cached results.
   */
  readonly cacheKey?: string | number | undefined;
  /** Debounce applied before a fetch fires, in milliseconds. @default 60 */
  readonly debounceMs?: number | undefined;
  /** When `false`, no fetch is scheduled and the adapter stays empty. @default true */
  readonly enabled?: boolean | undefined;
}

/** The result of {@link injectLiveCompletionAdapter}. */
export interface LiveCompletionAdapterBundle {
  /** Bind to `[adapter]`; its identity changes when fresh results arrive. */
  readonly adapter: Signal<TriggerAdapter>;
  /** `true` while a fetch is pending or in flight. Bind to `[isLoading]`. */
  readonly isLoading: Signal<boolean>;
}

/** Sentinel that no real query (including the empty string) equals, so the first query always fetches. */
const NO_QUERY = '\u0000';

interface LiveState {
  readonly query: string;
  readonly items: readonly TriggerItem[];
  readonly failed: boolean;
  readonly key: string | number | undefined;
}

/**
 * Bridges an async completion source (a server search, an RPC) into the
 * synchronous {@link TriggerAdapter} the popover consumes. `search(query)`
 * returns the last fetched items synchronously and schedules a debounced fetch
 * when the query changes; when results arrive the `adapter` signal changes
 * identity, which re-runs the popover's lookup. It is a search-only adapter
 * (no categories). A failed fetch is not retried by the render that shows the failure;
 * a later lookup of the same query retries it.
 *
 * Must be called in an injection context. React name:
 * `unstable_useLiveCompletionAdapter`.
 *
 * @deprecated Experimental since 2026-06-15. Not scheduled for removal; the API may change in any release.
 *
 * @example
 * ```ts
 * readonly people = injectLiveCompletionAdapter({ fetcher: (q) => searchUsers(q) });
 * ```
 * ```html
 * <div auiComposerTriggerPopover char="@" [adapter]="people.adapter()" [isLoading]="people.isLoading()">…</div>
 * ```
 */
export function injectLiveCompletionAdapter(
  options:
    Unstable_UseLiveCompletionAdapterOptions | (() => Unstable_UseLiveCompletionAdapterOptions),
): LiveCompletionAdapterBundle {
  assertInInjectionContext(injectLiveCompletionAdapter);
  const resolve = () => (typeof options === 'function' ? options() : options);
  const enabled = () => resolve().enabled ?? true;
  const cacheKey = () => resolve().cacheKey;

  const state = signal<LiveState>({ query: NO_QUERY, items: [], failed: false, key: cacheKey() });
  const loading = signal(false);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let token = 0;
  let pendingQuery: string | null = null;
  // A failed state whose failure render has already read it; a later lookup may retry.
  let observedFailure: LiveState | null = null;
  let destroyed = false;

  const invalidatePending = () => {
    clearTimeout(timer);
    timer = undefined;
    pendingQuery = null;
    token += 1;
    loading.set(false);
  };

  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
    invalidatePending();
  });

  const scheduleFetch = (query: string) => {
    if (destroyed || !enabled()) return;
    const key = cacheKey();
    if (state().key !== key) {
      invalidatePending();
      observedFailure = null;
      state.set({ query: NO_QUERY, items: [], failed: false, key });
    }
    if (pendingQuery === query) return;
    pendingQuery = query;
    clearTimeout(timer);
    const current = ++token;
    loading.set(true);
    timer = setTimeout(() => {
      timer = undefined;
      Promise.resolve()
        .then(() => resolve().fetcher(query))
        .then(
          (items) => {
            if (current !== token) return;
            state.set({ query, items, failed: false, key });
            loading.set(false);
          },
          () => {
            if (current !== token) return;
            pendingQuery = null;
            state.set({ query, items: [], failed: true, key });
            loading.set(false);
          },
        );
    }, resolve().debounceMs ?? 60);
  };

  const adapter = computed<TriggerAdapter>(() => {
    const s = state();
    return {
      categories: () => [],
      categoryItems: () => [],
      search: (query: string) => {
        if (!enabled()) {
          // search() runs inside a computed; defer signal writes out of it.
          queueMicrotask(() => {
            invalidatePending();
            // Disabling drops cached results, so re-enabling refetches.
            if (state().query !== NO_QUERY) {
              state.set({ query: NO_QUERY, items: [], failed: false, key: cacheKey() });
            }
          });
          return [];
        }
        const key = cacheKey();
        // The lookup that renders a failure must not retry it (that would loop on a
        // dead backend); only a later lookup of the same failed state may.
        let retry = false;
        if (s.failed && s.query === query && s.key === key) {
          if (observedFailure === s) retry = true;
          else observedFailure = s;
        }
        if (query !== s.query || s.key !== key || retry) {
          queueMicrotask(() => scheduleFetch(query));
        } else {
          queueMicrotask(() => {
            if (pendingQuery !== null && pendingQuery !== query) invalidatePending();
          });
        }
        return s.key === key ? s.items : [];
      },
    };
  });

  return { adapter, isLoading: loading.asReadonly() };
}
