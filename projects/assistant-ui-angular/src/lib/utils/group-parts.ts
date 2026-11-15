// Ported from packages/core/src/react/utils/groupParts.ts @ 7d74276
// and packages/core/src/utils/getGroupStatus.ts (getGroupSummary) @ 7d74276
// and packages/react/src/primitives/message/MessagePartsGrouped.tsx (groupMessagePartsByParentId) @ 7d74276
// (core exports neither from a React-free entry, so both are re-implemented here).
import { isMcpAppUri, type MessagePartStatus, type MessagePartTiming } from '@assistant-ui/core';
import type { AssistantState } from '@assistant-ui/store/client';

/** The state of one message part, as read through `s.part`. */
export type PartState = AssistantState['part'];

/** The status of a part, including the tool-call specific statuses. */
export type PartStatus = PartState['status'];

/**
 * Registry context passed to a `groupBy` function as its second argument by
 * `aui-message-grouped-parts`. Carries the live tool-UI registry so a
 * `groupBy` can resolve registry-driven grouping (e.g. standalone tool calls).
 */
export interface GroupByContext {
  /** Tool UIs registered in the tool-UI registry, keyed by tool name. */
  readonly toolUIs?: Readonly<Record<string, readonly { readonly standalone?: boolean }[]>>;
}

/**
 * Symbol attached to memoizable `groupBy` functions (those returned by
 * {@link groupPartByType}). Carries a string fingerprint of the config so
 * `aui-message-grouped-parts` rebuilds its tree only when the fingerprint
 * changes, even if the helper call site reconstructs the function.
 */
export const GROUPBY_MEMO_KEY: unique symbol = Symbol.for('@assistant-ui/groupBy.memoKey');

/**
 * Part-type keys recognized by {@link groupPartByType}, in addition to real
 * part types: `standalone-tool-call` (MCP-app tool calls plus any tool call
 * whose registered UI opts into standalone display; takes precedence over
 * `tool-call`) and `tool-call:<name>` (matches by tool name; takes precedence
 * over the plain `tool-call` entry).
 */
export type GroupPartType = PartState['type'] | 'standalone-tool-call' | `tool-call:${string}`;

/**
 * Builds a `groupBy` from a part-type to group-key-path lookup. Parts whose
 * type is not in the map are left ungrouped. The returned function carries a
 * stable memo fingerprint so `aui-message-grouped-parts` can keep its tree
 * across re-creations of the function.
 *
 * @example
 * ```ts
 * readonly groupBy = groupPartByType({
 *   reasoning: ['group-thought', 'group-reasoning'],
 *   'tool-call': ['group-thought', 'group-tool'],
 * });
 * ```
 */
export function groupPartByType<TKey extends `group-${string}`>(
  map: Partial<Readonly<Record<GroupPartType, readonly TKey[]>>>,
): (part: PartState, context?: GroupByContext) => readonly TKey[] {
  const lookup = map as Readonly<Record<string, readonly TKey[] | undefined>>;
  const fn = ((part: PartState, context?: GroupByContext) => {
    if (part.type === 'tool-call') {
      const isMcpApp = isMcpAppUri(part.mcp?.app?.resourceUri);
      // The first registration's flag is the one that renders, so grouping
      // and rendering never disagree for a tool name.
      const isStandalone =
        isMcpApp || (context?.toolUIs?.[part.toolName]?.[0]?.standalone ?? false);
      const standalone = lookup['standalone-tool-call'];
      if (isStandalone && standalone !== undefined) return standalone;
      const named = lookup[`tool-call:${part.toolName}`];
      if (named !== undefined) return named;
      return lookup['tool-call'] ?? [];
    }
    return lookup[part.type] ?? [];
  }) as ((part: PartState, context?: GroupByContext) => readonly TKey[]) & {
    [GROUPBY_MEMO_KEY]?: string;
  };
  // Sorted so the fingerprint ignores declaration order.
  const entries = Object.keys(map)
    .sort()
    .map((key) => [key, map[key as keyof typeof map]]);
  fn[GROUPBY_MEMO_KEY] = `groupPartByType:${JSON.stringify(entries)}`;
  return fn;
}

/** A node of the grouped tree: a coalesced group or a single part. */
export type GroupNode = GroupNodeGroup | GroupNodePart;

/** A coalesced run of adjacent parts. */
export interface GroupNodeGroup {
  readonly type: 'group';
  /** Current-level group key (last segment of the path). */
  readonly key: string;
  /** Structural key: sibling-index path such as `0.1.0`. */
  readonly nodeKey: string;
  /** Identity key (`id:<partId>`) from the group's first part; undefined when absent or already claimed. */
  readonly idKey: string | undefined;
  /** Indices of the parts in this subtree, in order. */
  readonly indices: readonly number[];
  readonly children: readonly GroupNode[];
}

/** A single part leaf. */
export interface GroupNodePart {
  readonly type: 'part';
  /** Index of the part in the message. */
  readonly index: number;
  /** Structural key: sibling-index path within the parent. */
  readonly nodeKey: string;
  /** Identity key (`id:<partId>`); undefined when absent or already claimed. */
  readonly idKey: string | undefined;
}

interface BuildFrame {
  key: string;
  nodeKey: string;
  indices: number[];
  children: GroupNode[];
  nextChildIdx: number;
  claimed: Set<string>;
}

const makeChildNodeKey = (parent: BuildFrame): string => {
  const idx = parent.nextChildIdx++;
  return parent.nodeKey === '' ? String(idx) : `${parent.nodeKey}.${idx}`;
};

const claimIdKey = (frame: BuildFrame, id: string | undefined): string | undefined => {
  if (id === undefined || frame.claimed.has(id)) return undefined;
  frame.claimed.add(id);
  return `id:${id}`;
};

const newFrame = (key: string, nodeKey: string): BuildFrame => ({
  key,
  nodeKey,
  indices: [],
  children: [],
  nextChildIdx: 0,
  claimed: new Set(),
});

/**
 * Builds the group tree from one normalized group path per part
 * (`paths[i]` is the path of part `i`). Adjacent parts sharing a path prefix
 * coalesce into the same group; ungrouped parts are direct children of the
 * root. The tree holds one `part` node per part and one `group` node per run.
 */
export function buildGroupTree(
  paths: readonly (readonly string[])[],
  partIds?: readonly (string | undefined)[],
): readonly GroupNode[] {
  const root = newFrame('', '');
  const stack: BuildFrame[] = [root];

  const closeTop = (): void => {
    const closing = stack.pop()!;
    const parent = stack[stack.length - 1]!;
    const id = partIds?.[closing.indices[0]!];
    parent.children.push({
      type: 'group',
      key: closing.key,
      nodeKey: closing.nodeKey,
      idKey: claimIdKey(parent, id?.includes(':') ? id : undefined),
      indices: closing.indices,
      children: closing.children,
    });
  };

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;

    // Longest prefix shared between the open groups (excluding root) and this path.
    let common = 0;
    while (
      common < stack.length - 1 &&
      common < path.length &&
      stack[common + 1]!.key === path[common]
    ) {
      common++;
    }
    while (stack.length - 1 > common) closeTop();
    while (stack.length - 1 < path.length) {
      const parent = stack[stack.length - 1]!;
      stack.push(newFrame(path[stack.length - 1]!, makeChildNodeKey(parent)));
    }

    const top = stack[stack.length - 1]!;
    top.children.push({
      type: 'part',
      index: i,
      nodeKey: makeChildNodeKey(top),
      idKey: claimIdKey(top, partIds?.[i]),
    });
    for (let s = 1; s < stack.length; s++) stack[s]!.indices.push(i);
  }

  while (stack.length > 1) closeTop();
  return root.children;
}

const COMPLETE_STATUS: MessagePartStatus = Object.freeze({ type: 'complete' });
const RUNNING_STATUS: MessagePartStatus = Object.freeze({ type: 'running' });

/** Per-status tallies over a group's `indices`; they sum to `indices.length`. */
export interface GroupCounts {
  readonly running: number;
  readonly complete: number;
  readonly incomplete: number;
  readonly requiresAction: number;
}

interface TimedPart {
  readonly status: PartStatus;
  readonly timing?: MessagePartTiming | undefined;
}

/**
 * Summarises the parts at `indices`: running when any of them runs, otherwise
 * the status of the last one; per-status counts; and the wall-clock span of
 * the timed parts.
 */
export function getGroupSummary(
  parts: readonly (TimedPart | undefined)[],
  indices: readonly number[],
): { status: PartStatus; counts: GroupCounts; timing?: MessagePartTiming } {
  const counts = { running: 0, complete: 0, incomplete: 0, requiresAction: 0 };
  let status: PartStatus = COMPLETE_STATUS;
  let isRunning = false;
  let startedAt: number | undefined;
  let completedAt: number | undefined;
  let isSettled = true;

  for (const index of indices) {
    const timing = parts[index]?.timing;
    if (timing) {
      startedAt = Math.min(startedAt ?? timing.startedAt, timing.startedAt);
      if (timing.completedAt === undefined) isSettled = false;
      else completedAt = Math.max(completedAt ?? timing.completedAt, timing.completedAt);
    }
    status = parts[index]?.status ?? COMPLETE_STATUS;
    switch (status.type) {
      case 'running':
        counts.running++;
        isRunning = true;
        break;
      case 'complete':
        counts.complete++;
        break;
      case 'incomplete':
        counts.incomplete++;
        break;
      case 'requires-action':
        counts.requiresAction++;
        break;
    }
  }

  const timing: MessagePartTiming | undefined =
    startedAt === undefined
      ? undefined
      : !isRunning && isSettled && completedAt !== undefined
        ? { startedAt, completedAt }
        : { startedAt };

  return {
    status: isRunning ? RUNNING_STATUS : status,
    counts,
    ...(timing && { timing }),
  };
}

/** A custom cluster of parts: an optional key and the indices of its parts. */
export interface PartIndexGroup {
  /** The cluster key; `undefined` leaves the parts ungrouped. */
  readonly groupKey: string | undefined;
  /** Indices of the cluster's parts in the message. */
  readonly indices: number[];
}

/**
 * Clusters message parts by any criterion: returns the groups, each with a
 * key and the part indices it holds (not necessarily adjacent). Used by
 * `aui-message-parts-grouped` (React's `Unstable_PartsGrouped`).
 */
export type GroupingFunction = (parts: readonly any[]) => PartIndexGroup[]; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Groups parts by their `parentId`. Parts without one stay in their
 * chronological position as individual groups; parts sharing a parent are
 * gathered at the position of the parent's first occurrence, even when other
 * parts sit between them (React's `Unstable_PartsGroupedByParentId`).
 */
export const groupMessagePartsByParentId: GroupingFunction = (parts) => {
  // A Map keeps insertion order, so groups appear in order of first occurrence.
  const groupMap = new Map<string | number, number[]>();
  for (let i = 0; i < parts.length; i++) {
    const parentId = parts[i]?.parentId as string | undefined;
    // Parts without a parent get a unique group id to keep their position.
    const groupId = parentId ?? i;
    const indices = groupMap.get(groupId) ?? [];
    indices.push(i);
    groupMap.set(groupId, indices);
  }
  return Array.from(groupMap, ([groupId, indices]) => ({
    groupKey: typeof groupId === 'string' ? groupId : undefined,
    indices,
  }));
};
