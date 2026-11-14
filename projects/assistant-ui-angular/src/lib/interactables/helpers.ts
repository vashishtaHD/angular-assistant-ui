// Ported from packages/core/src/model-context/interactable-composer-metadata.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (the small helpers that core does not export)

/** The model-facing tool name for an interactable `name`. One tool per name. */
export function interactableToolName(name: string): string {
  return `update_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

/** The prefix of every interactable update tool name. */
export const UPDATE_TOOL_PREFIX = 'update_';

/**
 * A tool call's result as a record. LangGraph and LangChain send a frontend
 * tool's result as JSON text and bring it back as that text.
 */
export const toolResultRecord = (result: unknown): Record<string, unknown> | undefined => {
  if (typeof result === 'string' && result.startsWith('{')) {
    try {
      result = JSON.parse(result);
    } catch {
      return undefined;
    }
  }
  return typeof result === 'object' && result !== null && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : undefined;
};

/**
 * Whether `p` is the call that created instance `id` of interactable `name`:
 * the call is named after the interactable, or its result names it.
 */
export const isInteractableCreateCall = (
  p: { toolCallId?: string | undefined; toolName?: string | undefined; result?: unknown },
  id: string,
  name: string,
): boolean =>
  p.toolCallId === id &&
  (p.toolName === name || toolResultRecord(p.result)?.['interactable'] === name);

let nextAutoId = 0;

/** A fresh instance id for interactables registered without one. */
export const nextInteractableId = (): string => `auiInteractable${nextAutoId++}`;
