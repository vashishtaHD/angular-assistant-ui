// Ported from packages/core/src/react/utils/threadRows.ts, packages/core/src/react/utils/groupParts.ts (buildGroupTree)
// and packages/core/src/utils/getGroupStatus.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// Ported rather than imported: `@assistant-ui/core/react` evaluates React at runtime.
import { getMessagePartKeys } from '@assistant-ui/core/internal';
import type { AssistantState } from '@assistant-ui/store/client';

type MessageState = AssistantState['thread']['messages'][number];
type PartState = AssistantState['part'];
type PartStatus = PartState['status'];
interface PartTiming {
  startedAt: number;
  completedAt?: number;
}

/** Registry context handed to a `groupBy` function. */
export interface GroupByContext {
  /** Tool UIs registered in the tool-UI registry, keyed by tool name. */
  readonly toolUIs?: NonNullable<AssistantState['optional']['tools']>['toolUIs'];
}

/** A node of a message's part grouping: a coalesced group or a single part. */
export type GroupNode = GroupNodeGroup | GroupNodePart;

/** A run of adjacent parts that `groupBy` coalesced. */
export interface GroupNodeGroup {
  readonly type: 'group';
  /** Current-level group key (last segment of the path). */
  readonly key: string;
  /** Structural key: the sibling-index path, e.g. `"0.1.0"`. */
  readonly nodeKey: string;
  /** Identity key from the group's first part, when present and unclaimed. */
  readonly idKey: string | undefined;
  /** Indices of parts in this subtree, in order. */
  readonly indices: readonly number[];
  readonly children: readonly GroupNode[];
}

/** A single part in a grouping. */
export interface GroupNodePart {
  readonly type: 'part';
  /** Index of the part in the message. */
  readonly index: number;
  readonly nodeKey: string;
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

/**
 * Builds the group tree from one normalized group path per part. Adjacent
 * parts sharing a path prefix coalesce into the same group.
 */
export const buildGroupTree = (
  paths: readonly (readonly string[])[],
  partIds?: readonly (string | undefined)[],
): readonly GroupNode[] => {
  const root: BuildFrame = {
    key: '',
    nodeKey: '',
    indices: [],
    children: [],
    nextChildIdx: 0,
    claimed: new Set(),
  };
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
      stack.push({
        key: path[stack.length - 1]!,
        nodeKey: makeChildNodeKey(parent),
        indices: [],
        children: [],
        nextChildIdx: 0,
        claimed: new Set(),
      });
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
};

/** Per-status tallies over a group's `indices`; they sum to `indices.length`. */
export interface GroupCounts {
  readonly running: number;
  readonly complete: number;
  readonly incomplete: number;
  readonly requiresAction: number;
}

const RUNNING = Object.freeze({ type: 'running' }) as PartStatus;
const COMPLETE = Object.freeze({ type: 'complete' }) as PartStatus;

/** Status, counts and timing summary of the parts at `indices`. */
export const getGroupSummary = (
  parts: readonly { status: PartStatus; timing?: PartTiming | undefined }[],
  indices: readonly number[],
): { status: PartStatus; counts: GroupCounts; timing?: PartTiming } => {
  const counts = { running: 0, complete: 0, incomplete: 0, requiresAction: 0 };
  let status: PartStatus = COMPLETE;
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
    status = parts[index]?.status ?? COMPLETE;
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

  const timing: PartTiming | undefined =
    startedAt === undefined
      ? undefined
      : !isRunning && isSettled && completedAt !== undefined
        ? { startedAt, completedAt }
        : { startedAt };

  return { status: isRunning ? RUNNING : status, counts, ...(timing && { timing }) };
};

/**
 * One row of a flattened thread, for rendering a long thread through a
 * virtualized list. A row is structural: it names what to render, and the
 * content is read from the store when it renders.
 *
 * - `"message"`: a whole user or system message, or an assistant message that
 *   is being edited.
 * - `"part"`: one top-level node of an assistant message's part grouping: a
 *   single part, or a group of adjacent parts that `groupBy` coalesced.
 * - `"turn-end"`: closes a turn once it has an assistant reply; it renders in
 *   the scope of the turn's last message and carries the turn's wall-clock span.
 */
export type ThreadRow =
  | {
      readonly type: 'message';
      /** Stable across streaming and earlier pages; use it as the list key. */
      readonly key: string;
      readonly messageId: string;
      /** The first message of the row's turn. */
      readonly turnMessageId: string;
    }
  | {
      readonly type: 'part';
      readonly key: string;
      readonly messageId: string;
      readonly turnMessageId: string;
      /** Indices of the message parts in this row, in order. */
      readonly indices: readonly number[];
      /** The group key `groupBy` returned for the row, when it coalesced parts. */
      readonly group?: `group-${string}`;
    }
  | {
      readonly type: 'turn-end';
      readonly key: string;
      /** The turn's last message, whose scope the row renders in. */
      readonly messageId: string;
      readonly turnMessageId: string;
      /** The turn's first message `createdAt`, in epoch milliseconds. */
      readonly startedAt: number;
      /** The latest end the turn records; absent while it runs or records none. */
      readonly completedAt?: number;
    };

/** Options for {@link createThreadRowsSelector}. */
export interface ThreadRowsOptions {
  /**
   * Coalesces adjacent parts of an assistant message into one row, with the
   * same contract as a grouped-parts `groupBy`; a row is a top-level node of
   * that grouping. Without it, every part is its own row.
   */
  readonly groupBy?:
    ((part: PartState, context: GroupByContext) => readonly `group-${string}`[] | null) | undefined;
}

const rowNodes = new WeakMap<ThreadRow, GroupNode>();

/** The group subtree a part row renders, when the row came from a selector. */
export const getThreadRowNode = (row: ThreadRow): GroupNode | undefined => rowNodes.get(row);

const EMPTY_ROWS: readonly ThreadRow[] = Object.freeze([]);
const NO_TOOL_UIS = {};

const recordedEnds = new WeakMap<MessageState, number | null>();

const getRecordedEnd = (message: MessageState): number | null => {
  const cached = recordedEnds.get(message);
  if (cached !== undefined) return cached;
  let end: number | null = null;
  if (message.role === 'assistant') {
    const timing = message.metadata.timing;
    if (timing?.totalStreamTime !== undefined)
      end = timing.streamStartTime + timing.totalStreamTime;
    for (const part of message.parts) {
      const completedAt =
        part.type === 'reasoning' || part.type === 'tool-call'
          ? part.timing?.completedAt
          : undefined;
      if (completedAt !== undefined) end = end === null ? completedAt : Math.max(end, completedAt);
    }
  }
  recordedEnds.set(message, end);
  return end;
};

const isSameNode = (a: GroupNode | undefined, b: GroupNode): boolean => {
  if (!a || a.nodeKey !== b.nodeKey || a.idKey !== b.idKey) return false;
  if (a.type === 'part') return b.type === 'part' && a.index === b.index;
  return (
    b.type === 'group' &&
    a.key === b.key &&
    a.children.length === b.children.length &&
    a.children.every((child, i) => isSameNode(child, b.children[i]!))
  );
};

const isSameRow = (a: ThreadRow, b: ThreadRow): boolean => {
  if (
    a.type !== b.type ||
    a.key !== b.key ||
    a.messageId !== b.messageId ||
    a.turnMessageId !== b.turnMessageId
  ) {
    return false;
  }
  if (a.type === 'turn-end' && b.type === 'turn-end') {
    return a.startedAt === b.startedAt && a.completedAt === b.completedAt;
  }
  if (a.type !== 'part' || b.type !== 'part') return true;
  return (
    a.group === b.group &&
    a.indices.length === b.indices.length &&
    a.indices.every((index, i) => index === b.indices[i])
  );
};

/**
 * Creates a selector that flattens the current thread into rows (see
 * {@link ThreadRow}). It returns the same array for the same thread state, and
 * keeps returning the previous array and row objects while a streamed token
 * leaves the rows unchanged, so a list keyed by `row.key` re-renders only when
 * rows appear, disappear, regroup or a turn completes. Create one selector per
 * list.
 *
 * @example
 * ```ts
 * private readonly selectRows = createThreadRowsSelector({ groupBy });
 * readonly rows = injectAuiState((s) => this.selectRows(s));
 * ```
 */
export const createThreadRowsSelector = (options: ThreadRowsOptions = {}) => {
  const { groupBy } = options;
  const byInput = new WeakMap<
    readonly MessageState[],
    { toolUIs: object; rows: readonly ThreadRow[] }
  >();
  const byMessage = new WeakMap<
    MessageState,
    { toolUIs: object; turnMessageId: string; rows: readonly ThreadRow[] }
  >();
  let previous = new Map<string, ThreadRow>();
  let previousRows: readonly ThreadRow[] = EMPTY_ROWS;

  const reuse = (row: ThreadRow, node?: GroupNode): ThreadRow => {
    const existing = previous.get(row.key);
    const next =
      existing && isSameRow(existing, row) && (!node || isSameNode(rowNodes.get(existing), node))
        ? existing
        : row;
    if (node) rowNodes.set(next, node);
    return next;
  };

  const rowsOfMessage = (
    message: MessageState,
    turnMessageId: string,
    toolUIs: GroupByContext['toolUIs'],
  ): readonly ThreadRow[] => {
    if (message.role !== 'assistant' || message.composer.isEditing) {
      return [
        reuse({
          type: 'message',
          key: `message:${message.id}`,
          messageId: message.id,
          turnMessageId,
        }),
      ];
    }

    const parts = message.parts;
    if (parts.length === 0) return EMPTY_ROWS;
    const partKeys = getMessagePartKeys(parts);
    const context: GroupByContext = toolUIs ? { toolUIs } : {};
    const tree = buildGroupTree(
      parts.map((part) => groupBy?.(part as PartState, context) ?? []),
      partKeys,
    );
    return tree.map((node) =>
      node.type === 'part'
        ? reuse(
            {
              type: 'part',
              key: `part:${message.id}:${partKeys[node.index]}`,
              messageId: message.id,
              turnMessageId,
              indices: [node.index],
            },
            node,
          )
        : reuse(
            {
              type: 'part',
              key: `group:${message.id}:${node.key}:${node.idKey ?? node.indices[0]}`,
              messageId: message.id,
              turnMessageId,
              indices: node.indices,
              group: node.key as `group-${string}`,
            },
            node,
          ),
    );
  };

  return (state: AssistantState): readonly ThreadRow[] => {
    const messages = state.thread.messages;
    const toolUIs = state.optional.tools?.toolUIs;
    const toolUIsKey = toolUIs ?? NO_TOOL_UIS;
    const cached = byInput.get(messages);
    if (cached?.toolUIs === toolUIsKey) return cached.rows;

    const rows: ThreadRow[] = [];
    let turnMessageId: string | undefined;
    let turnStartedAt = 0;
    let turnEnd: number | null = null;
    let turnHasReply = false;
    for (let index = 0; index < messages.length; index++) {
      const message = messages[index]!;
      if (message.role === 'user' || turnMessageId === undefined) {
        turnMessageId = message.id;
        turnStartedAt = message.createdAt.getTime();
        turnEnd = null;
        turnHasReply = false;
      }
      if (message.role === 'assistant') turnHasReply = true;
      const end = getRecordedEnd(message);
      if (end !== null) turnEnd = turnEnd === null ? end : Math.max(turnEnd, end);

      const messageCache = byMessage.get(message);
      const messageRows =
        messageCache?.toolUIs === toolUIsKey && messageCache.turnMessageId === turnMessageId
          ? messageCache.rows
          : rowsOfMessage(message, turnMessageId, toolUIs);
      if (messageCache?.rows !== messageRows) {
        byMessage.set(message, { toolUIs: toolUIsKey, turnMessageId, rows: messageRows });
      }
      rows.push(...messageRows);

      const next = messages[index + 1];
      if (turnHasReply && (next === undefined || next.role === 'user')) {
        const status = message.status?.type;
        const settled = status !== 'running' && status !== 'requires-action';
        rows.push(
          reuse({
            type: 'turn-end',
            key: `turn-end:${turnMessageId}`,
            messageId: message.id,
            turnMessageId,
            startedAt: turnStartedAt,
            ...(settled && turnEnd !== null && { completedAt: turnEnd }),
          }),
        );
      }
    }

    const result =
      rows.length === previousRows.length && rows.every((row, index) => row === previousRows[index])
        ? previousRows
        : rows;
    if (result !== previousRows) {
      previous = new Map(result.map((row) => [row.key, row]));
      previousRows = result;
    }
    byInput.set(messages, { toolUIs: toolUIsKey, rows: result });
    return result;
  };
};
