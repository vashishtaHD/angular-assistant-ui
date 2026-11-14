/** Minimal shape of a stored message that reconciliation needs. */
export interface StoredMessageRef {
  id: string;
  role: string;
}

export interface ReconcilePlan {
  /** How many leading stored ids equal the leading active ids. */
  keep: number;
  /** Stored ids after the kept prefix. They must be removed from memory. */
  deleteIds: string[];
}

/**
 * Keeps the longest stored prefix whose ids equal the matching prefix of the active branch and
 * reports the stored ids after it.
 *
 * @param storedIds ids of the messages stored for the thread, oldest first
 * @param activeIds ids of the branch the client is sending, oldest first
 */
export function planReconcile(storedIds: string[], activeIds: string[]): ReconcilePlan {
  const limit = Math.min(storedIds.length, activeIds.length);
  let keep = 0;
  while (keep < limit && storedIds[keep] === activeIds[keep]) keep++;
  return { keep, deleteIds: storedIds.slice(keep) };
}

/**
 * Collapses runs of consecutive assistant messages into one unit keyed by the first message.
 *
 * Mastra stores the continuation of a resumed (approved) tool call as a separate assistant message,
 * while the client holds one message that was extended in place. Treating the run as one unit keeps
 * the stored log aligned with the client's ids.
 */
export function groupAssistantRuns<T extends StoredMessageRef>(messages: T[]): T[][] {
  const groups: T[][] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (message.role === 'assistant' && last && last[0].role === 'assistant') last.push(message);
    else groups.push([message]);
  }
  return groups;
}

/** The slice of Mastra memory that reconciliation uses. */
export interface ReconcileMemory {
  recall(args: {
    threadId: string;
    resourceId?: string;
    perPage: false;
    orderBy: { field: 'createdAt'; direction: 'ASC' };
  }): Promise<{ messages: StoredMessageRef[] }>;
  deleteMessages(ids: string[]): Promise<void>;
}

/**
 * Loads the thread's stored messages, deletes the ones that are not on the active branch and
 * returns the deleted ids. Selecting a branch changes nothing on the server; this runs on send.
 */
export async function reconcileThread(args: {
  memory: ReconcileMemory;
  threadId: string;
  resourceId: string;
  activeIds: string[];
  /** Maps a stored id to the id the client uses (see `unscopeMessageId`). */
  toClientId?: (storedId: string) => string;
}): Promise<{ deleted: string[] }> {
  const { memory, threadId, resourceId, activeIds } = args;
  const toClientId = args.toClientId ?? ((id: string) => id);
  const { messages } = await memory.recall({
    threadId,
    resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  const groups = groupAssistantRuns(messages);
  const plan = planReconcile(
    groups.map((group) => toClientId(group[0].id)),
    activeIds,
  );
  const deleted = groups.slice(plan.keep).flatMap((group) => group.map((m) => m.id));
  if (deleted.length > 0) await memory.deleteMessages(deleted);
  return { deleted };
}
