import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  buildChatBody,
  chatUrl,
  historyUrl,
  storedIdsAfterRun,
  threadUrl,
  threadsUrl,
} from './contract';

const msg = (id: string, role: UIMessage['role']): UIMessage => ({
  id,
  role,
  parts: [{ type: 'text', text: id }],
});

const ids = (messages: UIMessage[]) => messages.map((m) => m.id);

describe('contract URLs', () => {
  const e = { baseUrl: 'http://host:4111/', agentId: 'chatAgent' };

  it('builds the chat, history and memory-thread routes with the agentId query', () => {
    expect(chatUrl(e)).toBe('http://host:4111/chat/chatAgent');
    expect(historyUrl(e, 'a/b')).toBe('http://host:4111/chat/chatAgent/threads/a%2Fb/messages');
    expect(threadsUrl(e)).toBe('http://host:4111/api/memory/threads?agentId=chatAgent');
    expect(threadUrl(e, 't1')).toBe('http://host:4111/api/memory/threads/t1?agentId=chatAgent');
  });
});

describe('buildChatBody', () => {
  const branch = [msg('u1', 'user'), msg('a1', 'assistant'), msg('u2', 'user')];

  it('sends only the messages after the stored prefix, with the whole branch ids', () => {
    const body = buildChatBody({ threadId: 't1', messages: branch, stored: ['u1', 'a1'] });
    expect(ids(body.messages)).toEqual(['u2']);
    expect(body.messageIds).toEqual(['u1', 'a1', 'u2']);
    expect(body.memory).toEqual({ thread: 't1' });
  });

  it('sends the edited message after the point where the branch diverges', () => {
    const edited = [msg('u1', 'user'), msg('a1', 'assistant'), msg('u2x', 'user')];
    const body = buildChatBody({
      threadId: 't1',
      messages: edited,
      stored: ['u1', 'a1', 'u2', 'a2'],
    });
    expect(ids(body.messages)).toEqual(['u2x']);
    expect(body.messageIds).toEqual(['u1', 'a1', 'u2x']);
  });

  it('re-sends a switched-to branch the server no longer stores', () => {
    const old = [
      msg('u1', 'user'),
      msg('a1', 'assistant'),
      msg('u2', 'user'),
      msg('a2', 'assistant'),
      msg('u3', 'user'),
    ];
    const body = buildChatBody({
      threadId: 't1',
      messages: old,
      stored: ['u1', 'a1', 'u2x', 'a2x'],
    });
    expect(ids(body.messages)).toEqual(['u2', 'a2', 'u3']);
  });

  it('always sends the last message (regenerate ends at a stored user message)', () => {
    const body = buildChatBody({
      threadId: 't1',
      messages: branch,
      stored: ['u1', 'a1', 'u2', 'a2'],
      trigger: 'regenerate-message',
    });
    expect(ids(body.messages)).toEqual(['u2']);
    expect(body.trigger).toBe('regenerate-message');
  });

  it('sends only the last assistant message on a resubmit', () => {
    const body = buildChatBody({
      threadId: 't1',
      messages: [...branch, msg('a2', 'assistant')],
      stored: [],
    });
    expect(ids(body.messages)).toEqual(['a2']);
    expect(body.messageIds).toEqual(['u1', 'a1', 'u2', 'a2']);
  });

  it('drops system messages and empty tool maps, and keeps resume fields', () => {
    const body = buildChatBody({
      threadId: 't1',
      messages: [msg('s', 'system'), msg('u1', 'user')],
      stored: [],
      tools: {},
      resumeData: { approved: true },
      runId: 'r1',
    });
    expect(ids(body.messages)).toEqual(['u1']);
    expect(body.messageIds).toEqual(['u1']);
    expect(body).not.toHaveProperty('tools');
    expect(body).toMatchObject({ resumeData: { approved: true }, runId: 'r1' });
  });
});

describe('buildChatBody with an unknown stored state', () => {
  const branch = [msg('u1', 'user'), msg('a1', 'assistant'), msg('u2', 'user')];

  it('sends the whole branch and omits messageIds, so the server deletes nothing', () => {
    const body = buildChatBody({ threadId: 't1', messages: branch, stored: undefined });
    expect(ids(body.messages)).toEqual(['u1', 'a1', 'u2']);
    expect(body).not.toHaveProperty('messageIds');
  });

  it('treats a known empty state differently from an unknown one', () => {
    const body = buildChatBody({ threadId: 't1', messages: [msg('u1', 'user')], stored: [] });
    expect(body.messageIds).toEqual(['u1']);
  });

  it('still sends only the last assistant message on a resubmit', () => {
    const body = buildChatBody({
      threadId: 't1',
      messages: [...branch, msg('a2', 'assistant')],
      stored: undefined,
    });
    expect(ids(body.messages)).toEqual(['a2']);
    expect(body).not.toHaveProperty('messageIds');
  });
});

describe('storedIdsAfterRun', () => {
  it('adds the streamed assistant id after a normal send', () => {
    const body = buildChatBody({ threadId: 't', messages: [msg('u1', 'user')], stored: [] });
    expect(storedIdsAfterRun(body, 'a1')).toEqual(['u1', 'a1']);
  });

  it('keeps the branch ids after a resubmit (the assistant unit is extended in place)', () => {
    const body = buildChatBody({
      threadId: 't',
      messages: [msg('u1', 'user'), msg('a1', 'assistant')],
      stored: [],
    });
    expect(storedIdsAfterRun(body, 'a1')).toEqual(['u1', 'a1']);
    expect(storedIdsAfterRun(body, 'other')).toEqual(['u1', 'a1']);
  });

  it('keeps the state unknown after a send without messageIds', () => {
    const body = buildChatBody({ threadId: 't', messages: [msg('u1', 'user')], stored: undefined });
    expect(storedIdsAfterRun(body, 'a1')).toBeUndefined();
  });
});
