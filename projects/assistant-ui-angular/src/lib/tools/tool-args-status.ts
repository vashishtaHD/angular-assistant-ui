// Ported from packages/core/src/react/model-context/useToolArgsStatus.ts @ 7d74276
// and the field-state walk of packages/assistant-stream/src/utils/json/parse-partial-json-object.ts
// (assistant-stream 0.3.57, MIT, Copyright (c) 2026 AgentbaseAI Inc.; see NOTICE)
import { assertInInjectionContext, computed, type Signal } from '@angular/core';
import type { AssistantState } from '@assistant-ui/store/client';
import { injectAuiState } from '../state/inject-aui-state';

type PropFieldStatus = 'streaming' | 'complete';

/** Streaming completion status for the arguments of the current tool call. */
export interface ToolArgsStatus<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  /** Overall lifecycle state of the tool-call part. */
  status: 'running' | 'complete' | 'incomplete' | 'requires-action';
  /**
   * Whether the full arguments object is still streaming, including fields
   * that have not arrived yet. Complete means the object has finished parsing
   * or the tool-call part is no longer running; it does not imply tool success.
   * Without parser metadata, falls back conservatively to the lifecycle.
   */
  argsStatus: PropFieldStatus;
  /** Per-argument status keyed by argument name. */
  propStatus: Partial<Record<keyof TArgs, PropFieldStatus>>;
}

type ToolCallPart = Extract<AssistantState['part'], { type: 'tool-call' }>;

interface PartialMeta {
  readonly state: 'partial' | 'complete';
  readonly partialPath: readonly string[];
}

// assistant-stream tags the objects its partial-JSON parser returns with a
// module-private symbol. The main entry may not import assistant-stream (it is
// an optional peer), so the tag is found by its description instead. This is a
// private seam, not a public contract: it is verified against assistant-stream
// 0.3.57 (the floor of the `^0.3.57` peer range) by specs that use the real
// parser and completion helper. A tag whose description or metadata shape
// differs is ignored, and the status falls back to the tool's lifecycle.
const META_DESCRIPTION = 'aui.parse-partial-json-object.meta';

const isPartialMeta = (value: unknown): value is PartialMeta => {
  if (typeof value !== 'object' || value === null) return false;
  const { state, partialPath } = value as Record<string, unknown>;
  return (
    (state === 'partial' || state === 'complete') &&
    Array.isArray(partialPath) &&
    partialPath.every((segment) => typeof segment === 'string')
  );
};

const metaOf = (value: unknown): PartialMeta | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  for (const symbol of Object.getOwnPropertySymbols(value)) {
    if (symbol.description === META_DESCRIPTION) {
      const meta = (value as Record<symbol, unknown>)[symbol];
      return isPartialMeta(meta) ? meta : undefined;
    }
  }
  return undefined;
};

const fieldState = (
  parent: unknown,
  parentMeta: PartialMeta,
  fieldPath: readonly string[],
): PartialMeta['state'] => {
  if (typeof parent !== 'object' || parent === null) return parentMeta.state;
  if (parentMeta.state === 'complete') return 'complete';
  if (fieldPath.length === 0) return parentMeta.state;
  const [field, ...restPath] = fieldPath as [string, ...string[]];
  if (!Object.hasOwn(parent, field)) return 'partial';
  const [partialField, ...restPartialPath] = parentMeta.partialPath;
  if (field !== partialField) return 'complete';
  return fieldState(
    (parent as Record<string, unknown>)[field],
    { state: 'partial', partialPath: restPartialPath },
    restPath,
  );
};

/**
 * Computes the {@link ToolArgsStatus} of a tool-call part. This is the pure
 * core of {@link injectToolArgsStatus}.
 */
export function computeToolArgsStatus<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
>(part: ToolCallPart): ToolArgsStatus<TArgs> {
  const statusType = part.status.type;
  const isStreaming = statusType === 'running';
  const args = part.args as Record<string, unknown>;
  const meta = metaOf(args);
  // A null-prototype record so an argument named `__proto__` is an own key.
  const propStatus = Object.create(null) as Record<string, PropFieldStatus>;

  for (const key of Object.keys(args)) {
    if (meta) {
      const state = fieldState(args, meta, [key]);
      propStatus[key] = state === 'complete' || !isStreaming ? 'complete' : 'streaming';
    } else {
      propStatus[key] = isStreaming ? 'streaming' : 'complete';
    }
  }

  return {
    status: statusType,
    argsStatus: meta?.state === 'complete' || !isStreaming ? 'complete' : 'streaming',
    propStatus: propStatus as Partial<Record<keyof TArgs, PropFieldStatus>>,
  };
}

/**
 * Returns a signal of whether each argument field of the current tool-call
 * part is still streaming or complete. `argsStatus` also accounts for fields
 * that have not arrived yet: an empty `propStatus` does not mean the object is
 * done. Arguments can be complete while `status` is still `"running"` during
 * execution. Use it inside a tool-call renderer to avoid showing incomplete
 * argument values as final.
 *
 * Must be called in an injection context inside a message part scope. Reading
 * the signal throws while the part is not a tool call.
 *
 * @example
 * ```ts
 * readonly args = injectToolArgsStatus<{ city: string }>();
 * // template: {{ args().propStatus.city === 'streaming' ? 'Reading city...' : city }}
 * ```
 */
export function injectToolArgsStatus<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
>(): Signal<ToolArgsStatus<TArgs>> {
  assertInInjectionContext(injectToolArgsStatus);
  const part = injectAuiState((s) => s.part);
  return computed(() => {
    const value = part();
    if (value.type !== 'tool-call') {
      throw new Error('injectToolArgsStatus can only be used inside tool-call message parts');
    }
    return computeToolArgsStatus<TArgs>(value);
  });
}
