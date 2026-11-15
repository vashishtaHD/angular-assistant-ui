import type { UIMessage, UIMessageChunk } from 'ai';
import type { ScriptedTurn } from './scripted-chat-transport';

/** Options shared by the scripted turn builders. */
export interface ScriptedTurnOptions {
  /** Delay between chunks in ms (see `createScriptedChatTransport`). Default: no delay. */
  delayMs?: number;
}

const withDelay = (chunks: UIMessageChunk[], options: ScriptedTurnOptions): ScriptedTurn =>
  options.delayMs ? { chunks, delayMs: options.delayMs } : { chunks };

const textChunks = (deltas: readonly string[], id = 'text-1'): UIMessageChunk[] => [
  { type: 'text-start', id },
  ...deltas.map((delta): UIMessageChunk => ({ type: 'text-delta', id, delta })),
  { type: 'text-end', id },
];

/**
 * A turn that streams one text part, delta by delta, in one step.
 *
 * @example
 * ```ts
 * createScriptedChatTransport([scriptedTextTurn('Hi ', 'there!')]);
 * createScriptedChatTransport([scriptedTextTurn({ text: 'slow', delayMs: 300 })]);
 * ```
 */
export function scriptedTextTurn(
  ...deltas: string[] | [ScriptedTurnOptions & { text: string | readonly string[] }]
): ScriptedTurn {
  const [first] = deltas;
  const options: ScriptedTurnOptions = typeof first === 'object' ? first : {};
  const parts =
    typeof first === 'object'
      ? typeof first.text === 'string'
        ? [first.text]
        : [...first.text]
      : (deltas as string[]);
  return withDelay(
    [
      { type: 'start' },
      { type: 'start-step' },
      ...textChunks(parts),
      { type: 'finish-step' },
      { type: 'finish' },
    ],
    options,
  );
}

/** A tool call for {@link scriptedApprovalTurn}. */
export interface ScriptedApprovalCall extends ScriptedTurnOptions {
  /** The tool call id. */
  toolCallId: string;
  /** The tool name, for example `bookMeeting`. */
  toolName: string;
  /** The tool input (arguments). */
  input: unknown;
  /** The approval request id. Default `approval-<toolCallId>`. */
  approvalId?: string;
}

/**
 * A turn that ends with a tool call waiting for the user's approval: the
 * tool input, then a `tool-approval-request` for it (AI SDK v7), finishing
 * with reason `tool-calls`. The styled `aui-tool-fallback` renders its
 * approval card; the part's `respondToToolApproval` answers it. With
 * `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`
 * (`MastraThreads` sets the equivalent by default) the answer resubmits, and
 * the script reads it with {@link toolApprovalOf} to reply with
 * {@link scriptedToolOutputTurn}.
 *
 * @example
 * ```ts
 * createScriptedChatTransport((messages) => {
 *   const approval = toolApprovalOf(messages, 'call-1');
 *   if (!approval) {
 *     return scriptedApprovalTurn({ toolCallId: 'call-1', toolName: 'bookMeeting', input: { title: 'Sync' } });
 *   }
 *   return approval.approved
 *     ? scriptedToolOutputTurn({ toolCallId: 'call-1', output: { confirmed: true }, text: 'Booked.' })
 *     : scriptedTextTurn('Not booked.');
 * });
 * ```
 */
export function scriptedApprovalTurn(call: ScriptedApprovalCall): ScriptedTurn {
  return withDelay(
    [
      { type: 'start' },
      { type: 'start-step' },
      {
        type: 'tool-input-available',
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        input: call.input,
      },
      {
        type: 'tool-approval-request',
        approvalId: call.approvalId ?? `approval-${call.toolCallId}`,
        toolCallId: call.toolCallId,
      },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'tool-calls' },
    ],
    call,
  );
}

/** The continuation for {@link scriptedToolOutputTurn}. */
export interface ScriptedToolOutput extends ScriptedTurnOptions {
  /** The call the output belongs to. */
  toolCallId: string;
  /** The tool's output (result). */
  output: unknown;
  /** Text streamed in a following step, if any. */
  text?: string;
}

/**
 * A continuation turn for a resubmit (after an approval or a client tool
 * result): the tool's output for an existing call, then optional text in a
 * new step. The AI SDK appends it to the last assistant message.
 */
export function scriptedToolOutputTurn(result: ScriptedToolOutput): ScriptedTurn {
  return withDelay(
    [
      { type: 'start' },
      { type: 'start-step' },
      { type: 'tool-output-available', toolCallId: result.toolCallId, output: result.output },
      { type: 'finish-step' },
      ...(result.text === undefined
        ? []
        : ([
            { type: 'start-step' },
            ...textChunks([result.text]),
            { type: 'finish-step' },
          ] satisfies UIMessageChunk[])),
      { type: 'finish' },
    ],
    result,
  );
}

/** An ask-user question for {@link scriptedAskUserTurn}. */
export interface ScriptedAskUser extends ScriptedTurnOptions {
  /** The question shown to the user. */
  question: string;
  /** Choices to offer. */
  options?: readonly string[];
  /** Whether several options can be picked. */
  multiple?: boolean;
  /** The tool call id. Default `ask-1`. */
  toolCallId?: string;
  /** The tool name. Default `askUser`, the reference Mastra server's tool. */
  toolName?: string;
}

/**
 * A turn that ends with an ask-user tool call: a client tool call with input
 * `{ question, options?, multiple? }` and no output, the shape the reference
 * Mastra server's `askUser` tool produces. The styled `aui-tool-fallback`
 * renders `aui-tool-fallback-ask-user` for it; answering adds the tool result
 * (`addToolResult`). With `sendAutomaticallyWhen:
 * lastAssistantMessageIsCompleteWithToolCalls` the answer resubmits, and the
 * script reads it with {@link askUserAnswerOf}.
 *
 * @example
 * ```ts
 * createScriptedChatTransport((messages) => {
 *   const answer = askUserAnswerOf(messages, 'ask-1');
 *   return answer === undefined
 *     ? scriptedAskUserTurn({ question: 'Which city?', options: ['Paris', 'Rome'] })
 *     : scriptedTextTurn(`Going to ${answer}.`);
 * });
 * ```
 */
export function scriptedAskUserTurn(ask: ScriptedAskUser): ScriptedTurn {
  return withDelay(
    [
      { type: 'start' },
      { type: 'start-step' },
      {
        type: 'tool-input-available',
        toolCallId: ask.toolCallId ?? 'ask-1',
        toolName: ask.toolName ?? 'askUser',
        input: {
          question: ask.question,
          ...(ask.options !== undefined && { options: [...ask.options] }),
          ...(ask.multiple !== undefined && { multiple: ask.multiple }),
        },
      },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'tool-calls' },
    ],
    ask,
  );
}

/** A tool part of a UI message (`tool-<name>` or `dynamic-tool`), loosely typed. */
export interface ScriptedToolPart {
  readonly type: string;
  readonly toolCallId: string;
  readonly state: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly approval?: {
    readonly id: string;
    readonly approved?: boolean;
    readonly reason?: string;
  };
}

const isToolPart = (part: { type: string }): part is ScriptedToolPart =>
  (part.type.startsWith('tool-') || part.type === 'dynamic-tool') && 'toolCallId' in part;

/**
 * The tool part with `toolCallId` in the messages a script receives, searching
 * from the latest message, or `undefined`.
 */
export function findToolPart(
  messages: readonly UIMessage[],
  toolCallId: string,
): ScriptedToolPart | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const part = messages[index]!.parts.find(
      (candidate) => isToolPart(candidate) && candidate.toolCallId === toolCallId,
    );
    if (part) return part as unknown as ScriptedToolPart;
  }
  return undefined;
}

/**
 * The user's answer to the approval request of `toolCallId`, once given
 * (`{ approved, reason? }`), or `undefined` while it is still pending or the
 * call does not exist.
 */
export function toolApprovalOf(
  messages: readonly UIMessage[],
  toolCallId: string,
): { approved: boolean; reason?: string } | undefined {
  const approval = findToolPart(messages, toolCallId)?.approval;
  if (approval?.approved === undefined) return undefined;
  return {
    approved: approval.approved,
    ...(approval.reason !== undefined && { reason: approval.reason }),
  };
}

/**
 * The result the user gave the ask-user call `toolCallId` (its tool output),
 * or `undefined` while it is unanswered.
 */
export function askUserAnswerOf(messages: readonly UIMessage[], toolCallId: string): unknown {
  const part = findToolPart(messages, toolCallId);
  return part?.state === 'output-available' ? part.output : undefined;
}
