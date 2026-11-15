// Ported from packages/ui/src/components/react/assistant-ui/elements/thread-list.aui.tsx
// (useThreadListGroups, dateGroupLabel, useStartOfToday) @ 7d74276
import { DestroyRef, NgZone, computed, inject, signal, type Signal } from '@angular/core';
import { injectAuiState, type AssistantState } from 'angular-assistant-ui';

type ThreadListItemState = AssistantState['threads']['threadItems'][number];

/** The date bucket labels of `aui-thread-list`, newest first. */
export type ThreadListGroupLabel =
  'Today' | 'Yesterday' | 'Previous 7 days' | 'Previous 30 days' | 'Older';

/** One date bucket: its label and the indices (into `threadIds`) it holds, newest first. */
export interface ThreadListGroup {
  /** The bucket label. */
  readonly label: ThreadListGroupLabel;
  /** Indices into `threadIds`, newest first. */
  readonly indices: number[];
}

/** The result of {@link groupThreadList} and {@link injectThreadListGroups}. */
export interface ThreadListGroups {
  /** The thread ids the indices point into. */
  readonly threadIds: readonly string[];
  /** Indices of the threads whose title matches the query, in runtime order. */
  readonly filteredIndices: number[];
  /**
   * The matches bucketed by last activity, or `null` when no match carries a
   * date or the local day start is unknown (then `filteredIndices` keeps the
   * runtime order).
   */
  readonly groups: ThreadListGroup[] | null;
}

const DAY_OFFSETS: readonly [ThreadListGroupLabel, number][] = [
  ['Today', 0],
  ['Yesterday', 1],
  ['Previous 7 days', 7],
  ['Previous 30 days', 30],
];

/** Local midnight `days` days before `startOfToday` (DST-safe). */
const daysBefore = (startOfToday: number, days: number): number => {
  const date = new Date(startOfToday);
  date.setDate(date.getDate() - days);
  return date.getTime();
};

/** Local midnight of `date`. */
export function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Filters threads by title (case-insensitive, trimmed query; untitled threads
 * match as "New Chat") and buckets the matches by `lastMessageAt` into Today,
 * Yesterday, Previous 7 days, Previous 30 days and Older. A thread without a
 * date counts as Today and sorts first, as upstream.
 */
export function groupThreadList(
  threadIds: readonly string[],
  threadItems: readonly ThreadListItemState[],
  searchQuery: string,
  startOfToday: number | undefined,
): ThreadListGroups {
  const query = searchQuery.trim().toLowerCase();
  const itemsById = new Map(threadItems.map((item) => [item.id, item]));
  const dates = threadIds.map((id) => itemsById.get(id)?.lastMessageAt);
  const filteredIndices = threadIds
    .map((id, index) => ({ id, index }))
    .filter(
      ({ id }) => !query || (itemsById.get(id)?.title || 'New Chat').toLowerCase().includes(query),
    )
    .map(({ index }) => index);
  if (startOfToday === undefined || !filteredIndices.some((index) => dates[index])) {
    return { threadIds, filteredIndices, groups: null };
  }

  const bounds = DAY_OFFSETS.map(
    ([label, days]) => [label, daysBefore(startOfToday, days)] as const,
  );
  const labelOf = (date: Date | undefined): ThreadListGroupLabel => {
    if (!date) return 'Today';
    const time = date.getTime();
    for (const [label, bound] of bounds) if (time >= bound) return label;
    return 'Older';
  };
  const time = (index: number) => dates[index]?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...filteredIndices].sort((a, b) => time(b) - time(a));

  const groups: ThreadListGroup[] = [];
  for (const index of sorted) {
    const label = labelOf(dates[index]);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.indices.push(index);
    else groups.push({ label, indices: [index] });
  }
  return { threadIds, filteredIndices, groups };
}

/**
 * Signal of {@link groupThreadList} over the regular threads of the current
 * thread list, for the query `searchQuery` returns. The local day start
 * refreshes at midnight. Must be called in an injection context inside an
 * `[auiProvider]`.
 */
export function injectThreadListGroups(searchQuery: () => string): Signal<ThreadListGroups> {
  const threadIds = injectAuiState((s) => s.threads.threadIds);
  const threadItems = injectAuiState((s) => s.threads.threadItems);
  const startOfToday = signal(startOfLocalDay(new Date()));

  // Re-read the clock at local midnight; outside Angular so stability waits never block on it.
  const zone = inject(NgZone);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    timer = setTimeout(() => {
      startOfToday.set(startOfLocalDay(new Date()));
      schedule();
    }, tomorrow - now.getTime());
  };
  zone.runOutsideAngular(schedule);
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));

  return computed(() => groupThreadList(threadIds(), threadItems(), searchQuery(), startOfToday()));
}
