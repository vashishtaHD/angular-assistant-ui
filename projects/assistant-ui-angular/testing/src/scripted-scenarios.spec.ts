// Angular addition (no upstream counterpart): specs for the scripted turn builders and
// the current-turn approval and ask-user readers.
import { AISDKChat } from '@assistant-ui/ai-sdk';
import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatInit,
  type UIMessage,
} from 'ai';
import { afterEach, describe, expect, it } from 'vitest';
import { mountAui, type MountedAui } from '../../src/testing-internal/mastra-host';
import { createScriptedChatTransport, type ScriptedTurn } from './scripted-chat-transport';
import {
  askUserAnswerOf,
  currentTurnMessages,
  findToolPart,
  scriptedApprovalTurn,
  scriptedAskUserTurn,
  scriptedTextTurn,
  scriptedToolOutputTurn,
  toolApprovalOf,
  turnToolCallId,
} from './scripted-scenarios';

let mounted: MountedAui | undefined;
afterEach(() => {
  mounted?.destroy();
  mounted = undefined;
});

const chunksOf = (turn: ScriptedTurn) => ('chunks' in turn ? turn.chunks : []);

const lastText = (aui: AssistantClient): string => {
  const messages = aui.thread().getState().messages;
  return (messages.at(-1)?.content ?? [])
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
};

/** Types `text` into the composer and sends it. */
const sendText = (aui: AssistantClient, text: string) => {
  aui.thread().composer().setText(text);
  aui.thread().composer().send();
};

/** The first tool-call part of the message at `index`, loosely typed. */
const toolCallOf = (aui: AssistantClient, index: number) =>
  aui
    .thread()
    .getState()
    .messages[index]?.content.find((part) => part.type === 'tool-call') as
    { toolCallId: string; toolName: string; result?: unknown; approval?: unknown } | undefined;

async function mountChat(
  script: (messages: UIMessage[]) => ScriptedTurn,
  sendAutomaticallyWhen?: ChatInit<UIMessage>['sendAutomaticallyWhen'],
) {
  const sends: UIMessage[][] = [];
  const transport = createScriptedChatTransport((messages) => {
    sends.push(structuredClone(messages));
    return script(messages);
  });
  mounted = await mountAui(() =>
    AuiConfig({
      threads: AISDKChat({ transport, ...(sendAutomaticallyWhen && { sendAutomaticallyWhen }) }),
    }),
  );
  return { aui: mounted.aui, mounted, sends };
}

describe('scriptedTextTurn', () => {
  it('streams the deltas as one text part between start and finish', () => {
    expect(chunksOf(scriptedTextTurn('Hi ', 'there!'))).toEqual([
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hi ' },
      { type: 'text-delta', id: 'text-1', delta: 'there!' },
      { type: 'text-end', id: 'text-1' },
      { type: 'finish-step' },
      { type: 'finish' },
    ]);
  });

  it('takes a delay from the options object form', () => {
    const turn = scriptedTextTurn({ text: 'slow', delayMs: 25 });
    expect(turn).toMatchObject({ delayMs: 25 });
    expect(chunksOf(turn)).toContainEqual({ type: 'text-delta', id: 'text-1', delta: 'slow' });
  });
});

describe('scriptedApprovalTurn and toolApprovalOf', () => {
  it('emits the tool input and an approval request for it', () => {
    const turn = scriptedApprovalTurn({
      toolCallId: 'call-1',
      toolName: 'bookMeeting',
      input: { title: 'Sync' },
    });
    expect(chunksOf(turn)).toEqual([
      { type: 'start' },
      { type: 'start-step' },
      {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'bookMeeting',
        input: { title: 'Sync' },
      },
      { type: 'tool-approval-request', approvalId: 'approval-call-1', toolCallId: 'call-1' },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'tool-calls' },
    ]);
  });

  it('drives a full approve, resubmit and continuation through AISDKChat', async () => {
    const { aui, mounted, sends } = await mountChat((messages) => {
      const approval = toolApprovalOf(messages, 'call-1');
      if (!approval) {
        return scriptedApprovalTurn({
          toolCallId: 'call-1',
          toolName: 'bookMeeting',
          input: { title: 'Sync', when: 'Monday' },
        });
      }
      return approval.approved
        ? scriptedToolOutputTurn({
            toolCallId: 'call-1',
            output: { confirmed: true },
            text: 'Booked.',
          })
        : scriptedTextTurn('Not booked.');
    }, lastAssistantMessageIsCompleteWithApprovalResponses);

    aui.thread().composer().setText('Book a sync');
    aui.thread().composer().send();
    const part = () => aui.thread().message({ index: 1 }).part({ toolCallId: 'call-1' });
    await mounted.waitFor(() =>
      expect(part().getState()).toMatchObject({ type: 'tool-call', toolName: 'bookMeeting' }),
    );
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    expect(toolApprovalOf(sends[0]!, 'call-1')).toBeUndefined();

    await part().respondToToolApproval({ approved: true, reason: 'fine' });

    await mounted.waitFor(() => expect(sends).toHaveLength(2));
    expect(toolApprovalOf(sends[1]!, 'call-1')).toEqual({ approved: true, reason: 'fine' });
    expect(findToolPart(sends[1]!, 'call-1')).toMatchObject({ state: 'approval-responded' });
    await mounted.waitFor(() => expect(lastText(aui)).toContain('Booked.'));
    await mounted.waitFor(() =>
      expect(part().getState()).toMatchObject({ result: { confirmed: true } }),
    );
  });

  it('reports a denial with its reason', async () => {
    const { aui, mounted, sends } = await mountChat(
      (messages) =>
        toolApprovalOf(messages, 'call-2')
          ? scriptedTextTurn('Not booked.')
          : scriptedApprovalTurn({ toolCallId: 'call-2', toolName: 'bookMeeting', input: {} }),
      lastAssistantMessageIsCompleteWithApprovalResponses,
    );
    aui.thread().composer().setText('Book');
    aui.thread().composer().send();
    const part = () => aui.thread().message({ index: 1 }).part({ toolCallId: 'call-2' });
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    await mounted.waitFor(() => expect(part().getState()).toMatchObject({ type: 'tool-call' }));

    await part().respondToToolApproval({ approved: false, reason: 'busy' });

    await mounted.waitFor(() => expect(sends).toHaveLength(2));
    expect(toolApprovalOf(sends[1]!, 'call-2')).toEqual({ approved: false, reason: 'busy' });
  });
});

describe('scriptedAskUserTurn and askUserAnswerOf', () => {
  it('emits an askUser call without output', () => {
    expect(
      chunksOf(scriptedAskUserTurn({ question: 'Colour?', options: ['Blue', 'Red'] })),
    ).toEqual([
      { type: 'start' },
      { type: 'start-step' },
      {
        type: 'tool-input-available',
        toolCallId: 'ask-1',
        toolName: 'askUser',
        input: { question: 'Colour?', options: ['Blue', 'Red'] },
      },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'tool-calls' },
    ]);
  });

  it('passes multiple, a custom tool name and call id through', () => {
    const [, , call] = chunksOf(
      scriptedAskUserTurn({
        toolCallId: 'q-9',
        toolName: 'clarify',
        question: 'Which?',
        options: ['a', 'b'],
        multiple: true,
      }),
    );
    expect(call).toEqual({
      type: 'tool-input-available',
      toolCallId: 'q-9',
      toolName: 'clarify',
      input: { question: 'Which?', options: ['a', 'b'], multiple: true },
    });
  });

  it('round-trips the answer through addToolResult and the resubmit', async () => {
    const { aui, mounted, sends } = await mountChat((messages) => {
      const answer = askUserAnswerOf(messages, 'ask-1');
      return answer === undefined
        ? scriptedAskUserTurn({ question: 'Colour?', options: ['Blue', 'Red'] })
        : scriptedTextTurn(`You chose ${JSON.stringify(answer)}.`);
    }, lastAssistantMessageIsCompleteWithToolCalls);

    aui.thread().composer().setText('Ask me');
    aui.thread().composer().send();
    const part = () => aui.thread().message({ index: 1 }).part({ toolCallId: 'ask-1' });
    await mounted.waitFor(() =>
      expect(part().getState()).toMatchObject({
        toolName: 'askUser',
        args: { question: 'Colour?', options: ['Blue', 'Red'] },
      }),
    );
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    expect(askUserAnswerOf(sends[0]!, 'ask-1')).toBeUndefined();

    part().addToolResult('Blue');

    await mounted.waitFor(() => expect(sends).toHaveLength(2));
    expect(askUserAnswerOf(sends[1]!, 'ask-1')).toBe('Blue');
    await mounted.waitFor(() => expect(lastText(aui)).toContain('You chose "Blue".'));
  });
});

describe('findToolPart', () => {
  it('finds static and dynamic tool parts by call id, latest message first', () => {
    const messages = [
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'tool-x', toolCallId: 'c1', state: 'input-available', input: {} }],
      },
      {
        id: 'a2',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'y',
            toolCallId: 'c2',
            state: 'output-available',
            input: {},
            output: 1,
          },
        ],
      },
    ] as unknown as UIMessage[];
    expect(findToolPart(messages, 'c1')).toMatchObject({ type: 'tool-x' });
    expect(findToolPart(messages, 'c2')).toMatchObject({ type: 'dynamic-tool', output: 1 });
    expect(findToolPart(messages, 'nope')).toBeUndefined();
  });
});

describe('the readers look only at the current turn', () => {
  const user = (id: string, text: string) => ({
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  });
  const answered = [
    user('u1', 'book'),
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-bookMeeting',
          toolCallId: 'call-1',
          state: 'approval-responded',
          input: {},
          approval: { id: 'approval-call-1', approved: true },
        },
        {
          type: 'tool-askUser',
          toolCallId: 'ask-1',
          state: 'output-available',
          input: { question: 'Colour?' },
          output: 'Blue',
        },
      ],
    },
  ];

  it('ignores an approval or answer given before the last user message', () => {
    const messages = [...answered, user('u2', 'book')] as unknown as UIMessage[];
    expect(currentTurnMessages(messages)).toEqual([]);
    expect(toolApprovalOf(messages, 'call-1')).toBeUndefined();
    expect(askUserAnswerOf(messages, 'ask-1')).toBeUndefined();
    expect(findToolPart(messages, 'call-1')).toBeUndefined();
  });

  it('reads them while the answered call is still in the current turn', () => {
    const messages = answered as unknown as UIMessage[];
    expect(currentTurnMessages(messages).map((message) => message.id)).toEqual(['a1']);
    expect(toolApprovalOf(messages, 'call-1')).toEqual({ approved: true });
    expect(askUserAnswerOf(messages, 'ask-1')).toBe('Blue');
  });

  it('approves the same request twice: each turn keeps its own answer', async () => {
    const { aui, mounted, sends } = await mountChat((messages) => {
      const toolCallId = turnToolCallId(messages, 'call');
      const approval = toolApprovalOf(messages, toolCallId);
      if (!approval) {
        return scriptedApprovalTurn({ toolCallId, toolName: 'bookMeeting', input: {} });
      }
      return approval.approved
        ? scriptedToolOutputTurn({ toolCallId, output: 'ok', text: 'Booked.' })
        : scriptedTextTurn(`Not booked: ${approval.reason ?? 'no reason'}.`);
    }, lastAssistantMessageIsCompleteWithApprovalResponses);

    sendText(aui, 'Book');
    await mounted.waitFor(() => expect(toolCallOf(aui, 1)?.approval).toBeDefined());
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    const first = toolCallOf(aui, 1)!.toolCallId;
    await aui.thread().message({ index: 1 }).part({ toolCallId: first }).respondToToolApproval({
      approved: true,
    });
    await mounted.waitFor(() => expect(lastText(aui)).toContain('Booked.'));
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    sendText(aui, 'Book again');
    await mounted.waitFor(() => expect(toolCallOf(aui, 3)?.approval).toBeDefined());
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    // The new request asked again, under its own call id.
    expect(sends).toHaveLength(3);
    const second = toolCallOf(aui, 3)!.toolCallId;
    expect(second).not.toBe(first);
    expect(toolCallOf(aui, 3)).toMatchObject({ result: undefined });
    expect(toolCallOf(aui, 3)).not.toHaveProperty('approval.approved');

    await aui.thread().message({ index: 3 }).part({ toolCallId: second }).respondToToolApproval({
      approved: false,
      reason: 'busy',
    });
    await mounted.waitFor(() => expect(lastText(aui)).toContain('Not booked: busy.'));
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    // The second resubmit carries the second answer; the first turn keeps its own.
    expect(sends).toHaveLength(4);
    expect(toolApprovalOf(sends[3]!, second)).toEqual({ approved: false, reason: 'busy' });
    expect(toolCallOf(aui, 1)).toMatchObject({ toolCallId: first, approval: { approved: true } });
    expect(toolCallOf(aui, 3)).toMatchObject({
      toolCallId: second,
      approval: { approved: false, reason: 'busy' },
    });
  });

  it('answers the same question twice: each turn keeps its own answer', async () => {
    const { aui, mounted, sends } = await mountChat((messages) => {
      const toolCallId = turnToolCallId(messages, 'ask');
      const answer = askUserAnswerOf(messages, toolCallId);
      return answer === undefined
        ? scriptedAskUserTurn({ toolCallId, question: 'Colour?', options: ['Blue', 'Red'] })
        : scriptedTextTurn(`You chose ${String(answer)}.`);
    }, lastAssistantMessageIsCompleteWithToolCalls);

    sendText(aui, 'Ask me');
    await mounted.waitFor(() => expect(toolCallOf(aui, 1)?.toolName).toBe('askUser'));
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    const first = toolCallOf(aui, 1)!.toolCallId;
    aui.thread().message({ index: 1 }).part({ toolCallId: first }).addToolResult('Blue');
    await mounted.waitFor(() => expect(lastText(aui)).toContain('You chose Blue.'));
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    sendText(aui, 'Ask me again');
    await mounted.waitFor(() => expect(toolCallOf(aui, 3)?.toolName).toBe('askUser'));
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    expect(sends).toHaveLength(3);
    const second = toolCallOf(aui, 3)!.toolCallId;
    expect(second).not.toBe(first);
    expect(askUserAnswerOf(sends[2]!, second)).toBeUndefined();

    aui.thread().message({ index: 3 }).part({ toolCallId: second }).addToolResult('Red');
    await mounted.waitFor(() => expect(lastText(aui)).toContain('You chose Red.'));
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    // The second resubmit carries the second answer; the first turn keeps its own.
    expect(sends).toHaveLength(4);
    expect(askUserAnswerOf(sends[3]!, second)).toBe('Red');
    expect(toolCallOf(aui, 1)).toMatchObject({ toolCallId: first, result: 'Blue' });
    expect(toolCallOf(aui, 3)).toMatchObject({ toolCallId: second, result: 'Red' });
  });
});

describe('turnToolCallId', () => {
  const user = (id: string) => ({ id, role: 'user', parts: [{ type: 'text', text: 'hi' }] });
  const assistant = (id: string) => ({ id, role: 'assistant', parts: [] });

  it('derives the id from the last user message, so each turn gets its own', () => {
    const turn1 = [user('u1'), assistant('a1')] as unknown as UIMessage[];
    const turn2 = [...turn1, user('u2')] as unknown as UIMessage[];
    expect(turnToolCallId(turn1, 'ask')).toBe('ask-u1');
    expect(turnToolCallId(turn2, 'ask')).toBe('ask-u2');
  });

  it('stays the same across the resubmits of one turn', () => {
    const sent = [user('u1')] as unknown as UIMessage[];
    const resubmit = [user('u1'), assistant('a1')] as unknown as UIMessage[];
    expect(turnToolCallId(resubmit, 'call')).toBe(turnToolCallId(sent, 'call'));
  });

  it('falls back to the prefix when there is no user message', () => {
    expect(turnToolCallId([], 'call')).toBe('call');
  });
});
