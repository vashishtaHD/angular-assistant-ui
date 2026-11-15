// Ported from packages/ui/src/components/vue/assistant-ui/tool-fallback.vue @ 7d74276
// (the script helpers) and packages/ui/src/components/react/assistant-ui/elements/tool-fallback.aui.tsx @ 7d74276
import type { ToolApprovalOption, ToolApprovalQuestion } from '@assistant-ui/core';
import type { ToolUIProps } from 'angular-assistant-ui';

/** The tool-call part a tool fallback renders. */
export type AuiToolCallPart = ToolUIProps['part'];

/** The approval request of a tool-call part. */
export type AuiToolApproval = NonNullable<AuiToolCallPart['approval']>;

/** Result added for an approved call that has no approval gate of its own. */
export const AUI_TOOL_APPROVED_RESULT = 'Approved by user';
/** Result added for a denied call that has no approval gate of its own. */
export const AUI_TOOL_DENIED_RESULT = 'User denied tool execution';

const APPROVAL_OPTION_DEFAULT_LABELS: Record<string, string> = {
  'allow-once': 'Allow',
  'allow-always': 'Always allow',
  'reject-once': 'Deny',
  'reject-always': 'Always deny',
};

/** Whether `kind` is one of the four approval option kinds with a known decision. */
export const isKnownApprovalKind = (kind: string): boolean =>
  Object.hasOwn(APPROVAL_OPTION_DEFAULT_LABELS, kind);

/** Whether `kind` allows the call. */
export const isAllowApprovalKind = (kind: string): boolean =>
  kind === 'allow-once' || kind === 'allow-always';

/** The button label of an approval option: its label, the kind's default, or its id. */
export const approvalOptionLabel = (option: ToolApprovalOption): string =>
  option.label ??
  (isKnownApprovalKind(option.kind) ? APPROVAL_OPTION_DEFAULT_LABELS[option.kind] : undefined) ??
  option.id;

/**
 * Whether the request asks a question rather than gating an action. A refusal
 * is not one of the answers a question accepts unless it is dismissible.
 */
export const isApprovalQuestion = (approval: AuiToolApproval | undefined): boolean =>
  approval?.display === 'select' ||
  approval?.display === 'text' ||
  approval?.display === 'questions';

/** Whether the request has been decided, or closed without a decision. */
export const isApprovalSettled = (approval: AuiToolApproval | undefined): boolean =>
  approval != null && (approval.approved !== undefined || approval.resolution !== undefined);

/** Whether a question of a `display: "questions"` request takes a typed answer. */
export const questionAcceptsText = (question: ToolApprovalQuestion): boolean =>
  !question.options?.length || question.allowFreeform === true;

/** Formats a tool result or error for display: strings as-is, everything else as JSON. */
export const formatUnknownValue = (value: unknown, space?: number): string => {
  if (typeof value === 'string') return value;
  try {
    if (value instanceof Error) return String(value);
    const json = JSON.stringify(value, null, space);
    if (json !== undefined) return json;
  } catch {
    // Fall through to String().
  }
  try {
    return String(value);
  } catch {
    return '[Unserializable value]';
  }
};

/** Formats a tool-call duration in milliseconds: `<1s`, `2.5s`, `12s`, `1m 5s`. */
export const formatToolDuration = (ms: number): string => {
  if (ms < 1000) return '<1s';
  const seconds = ms / 1000;
  if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

/**
 * Whether a waiting call offers the approve/deny decision: every waiting call
 * does, except an interrupt with neither an approval nor an interrupt payload
 * to answer.
 */
export const offersInterruptAction = (part: AuiToolCallPart): boolean => {
  const status = part.status;
  return (
    status.type !== 'requires-action' ||
    status.reason !== 'interrupt' ||
    part.approval != null ||
    part.interrupt != null
  );
};

/**
 * The arguments of an ask-user tool call (the Mastra demo's `askUser` tool):
 * a question, optional choices, and whether several choices can be picked.
 */
export interface AuiAskUserArgs {
  /** The question to show the user. */
  readonly question: string;
  /** Choices to offer. Absent or empty: a free-text answer. */
  readonly options?: readonly string[];
  /** Whether several options can be picked. */
  readonly multiple?: boolean;
}

/** Whether `args` have the {@link AuiAskUserArgs} shape. */
export const isAskUserArgs = (args: unknown): args is AuiAskUserArgs => {
  if (typeof args !== 'object' || args === null) return false;
  const { question, options, multiple } = args as Record<string, unknown>;
  return (
    typeof question === 'string' &&
    (options === undefined ||
      (Array.isArray(options) && options.every((option) => typeof option === 'string'))) &&
    (multiple === undefined || typeof multiple === 'boolean')
  );
};

/**
 * Whether the part is an ask-user call waiting for its answer: it waits on the
 * frontend for a result (no approval gate, no interrupt, no result yet) and
 * its arguments have the {@link AuiAskUserArgs} shape.
 */
export const isPendingAskUser = (part: AuiToolCallPart): boolean =>
  part.status.type === 'requires-action' &&
  part.status.reason === 'tool-calls' &&
  part.approval == null &&
  part.interrupt == null &&
  part.result === undefined &&
  isAskUserArgs(part.args);
