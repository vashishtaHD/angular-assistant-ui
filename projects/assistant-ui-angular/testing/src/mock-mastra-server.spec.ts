import type { UIMessage } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createMockMastraServer } from './mock-mastra-server';

const user = (id: string): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text: id }] });

const setup = (options: Parameters<typeof createMockMastraServer>[0] = {}) => {
  const server = createMockMastraServer(options);
  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const response = await server.fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body !== undefined && { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
      status: response.status,
      text,
      json: (() => {
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })(),
    };
  };
  const chat = (body: unknown, headers?: Record<string, string>) =>
    call('POST', '/chat/chatAgent', body, headers);
  return { server, call, chat };
};

const events = (text: string) =>
  text
    .split('\n')
    .filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; messageId?: string });

describe('createMockMastraServer', () => {
  it('streams a reply whose start carries the stored assistant id, then serves the history', async () => {
    const { server, chat, call } = setup();
    const res = await chat({
      messages: [user('u1')],
      messageIds: ['u1'],
      memory: { thread: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.text.trim().endsWith('data: [DONE]')).toBe(true);
    const start = events(res.text)[0]!;
    expect(start.type).toBe('start');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const history = await call('GET', '/chat/chatAgent/threads/t1/messages');
    expect(history.json?.['total']).toBe(2);
    expect((history.json?.['messages'] as UIMessage[]).map((m) => m.id)).toEqual([
      'u1',
      start.messageId,
    ]);
    // The title is set asynchronously after the turn.
    await vi.waitFor(() =>
      expect(server.threads()[0]).toMatchObject({ id: 't1', resourceId: 'dev-user', title: 'u1' }),
    );
  });

  it('reconciles the stored log with messageIds, except on resubmits', async () => {
    const { server, chat } = setup();
    server.seedThread({ id: 't1' }, [
      user('u1'),
      { id: 'a1', role: 'assistant', parts: [] },
      user('u2'),
      { id: 'a2', role: 'assistant', parts: [] },
      { id: 'a2b', role: 'assistant', parts: [] },
    ]);
    await chat({
      messages: [user('u2x')],
      messageIds: ['u1', 'a1', 'u2x'],
      memory: { thread: 't1' },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      server
        .messages('t1')
        .map((m) => m.id)
        .slice(0, 3),
    ).toEqual(['u1', 'a1', 'u2x']);
    expect(server.messages('t1')).toHaveLength(4);

    const last = server.messages('t1')[3]!;
    await chat({ messages: [last], messageIds: ['u1'], memory: { thread: 't1' } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(server.messages('t1')).toHaveLength(4);
  });

  it('does not reconcile without messageIds, and de-duplicates by id', async () => {
    const { server, chat } = setup();
    server.seedThread({ id: 't1' }, [user('u1'), { id: 'a1', role: 'assistant', parts: [] }]);
    await chat({ messages: [user('u1'), user('u2')], memory: { thread: 't1' } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      server
        .messages('t1')
        .map((m) => m.id)
        .slice(0, 3),
    ).toEqual(['u1', 'a1', 'u2']);
    expect(server.messages('t1')).toHaveLength(4);
  });

  it('failNext fails one matching request with a status or a network error', async () => {
    const { server, call } = setup();
    server.seedThread({ id: 't1' });
    const path = '/chat/chatAgent/threads/t1/messages';
    server.failNext({ method: 'GET', path }, { status: 503 });
    expect(await call('GET', path)).toMatchObject({
      status: 503,
      json: { error: 'Internal Server Error' },
    });
    expect((await call('GET', path)).status).toBe(200);
    server.failNext({ path: /\/messages$/ }, 'network');
    await expect(call('GET', path)).rejects.toThrow(TypeError);
    expect((await call('GET', path)).status).toBe(200);
  });

  it('answers the documented errors', async () => {
    const { server, chat, call } = setup({ maxBodyBytes: 200 });
    server.seedThread({ id: 'bobs', resourceId: 'bob' });
    expect((await chat('not json')).status).toBe(400);
    expect(
      (await chat({ messages: [{ id: 's', role: 'system', parts: [] }], memory: { thread: 't' } }))
        .status,
    ).toBe(400);
    expect((await chat({ messages: [user('u1')] })).status).toBe(400);
    expect(
      (await chat({ messages: [user('u1')], memory: { thread: 't' }, resumeData: { a: 1 } })).json,
    ).toEqual({ error: 'runId is required with resumeData' });
    expect(
      (await call('POST', '/chat/nope', { messages: [user('u1')], memory: { thread: 't' } }))
        .status,
    ).toBe(404);
    expect((await chat({ messages: [user('u1')], memory: { thread: 'bobs' } })).status).toBe(403);
    expect(
      (await chat({ messages: [user('x'.repeat(300))], memory: { thread: 't' } })).json,
    ).toEqual({
      error: 'Request body too large',
    });
    expect((await call('GET', '/chat/chatAgent/threads/none/messages')).status).toBe(404);
  });

  it('rejects an assistant id that belongs to another thread with 409', async () => {
    const { server, chat } = setup();
    server.seedThread({ id: 't1' }, [user('u1'), { id: 'a1', role: 'assistant', parts: [] }]);
    const res = await chat({
      messages: [{ id: 'a1', role: 'assistant', parts: [] }],
      memory: { thread: 't2' },
    });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: 'Message id already in use' });
  });

  it('denies every route outside the allow-list with 403', async () => {
    const { call } = setup();
    for (const [method, path] of [
      ['POST', '/api/agents/chatAgent/stream'],
      ['GET', '/api/agents'],
      ['GET', '/api/memory/threads/t1/messages'],
      ['POST', '/api/memory/save-messages'],
      ['PUT', '/api/memory/threads/t1'],
    ] as const) {
      expect(
        await call(method, path, method === 'GET' ? undefined : {}),
        `${method} ${path}`,
      ).toMatchObject({
        status: 403,
        json: { error: 'Access denied' },
      });
    }
  });

  it('implements the memory-thread routes with server-derived identity', async () => {
    const { call } = setup({ tokens: { a: 'alice', b: 'bob' } });
    const alice = { authorization: 'Bearer a' };
    const bob = { authorization: 'Bearer b' };
    expect((await call('GET', '/api/memory/threads?agentId=chatAgent')).status).toBe(401);
    expect(
      (await call('POST', '/api/memory/threads', { threadId: 't1', resourceId: 'x' }, alice))
        .status,
    ).toBe(400);
    expect(
      (
        await call(
          'POST',
          '/api/memory/threads?agentId=chatAgent',
          { threadId: 't1', resourceId: '' },
          alice,
        )
      ).status,
    ).toBe(400);
    const created = await call(
      'POST',
      '/api/memory/threads?agentId=chatAgent',
      { threadId: 't1', resourceId: 'bob', metadata: { archived: false, k: 1 } },
      alice,
    );
    expect(created.json).toMatchObject({ id: 't1', resourceId: 'alice', title: '' });
    expect(
      (
        await call(
          'POST',
          '/api/memory/threads?agentId=chatAgent',
          { threadId: 't1', resourceId: 'x' },
          bob,
        )
      ).status,
    ).toBe(403);
    expect(
      (await call('GET', '/api/memory/threads/t1?agentId=chatAgent', undefined, bob)).status,
    ).toBe(403);
    const patched = await call(
      'PATCH',
      '/api/memory/threads/t1?agentId=chatAgent',
      { metadata: { archived: true } },
      alice,
    );
    expect(patched.json?.['metadata']).toEqual({ archived: true });
    expect((await call('PATCH', '/api/memory/threads/t1', { title: 'x' }, alice)).status).toBe(400);
    const list = await call(
      'GET',
      '/api/memory/threads?agentId=chatAgent&page=0&perPage=1',
      undefined,
      bob,
    );
    expect(list.json).toEqual({ threads: [], total: 0, page: 0, perPage: 1, hasMore: false });
    expect(
      (await call('DELETE', '/api/memory/threads/t1?agentId=chatAgent', undefined, alice)).json,
    ).toEqual({
      result: 'Thread deleted',
    });
    expect(
      (await call('GET', '/api/memory/threads/t1?agentId=chatAgent', undefined, alice)).status,
    ).toBe(404);
  });
});
