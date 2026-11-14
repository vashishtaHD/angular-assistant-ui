import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { createMockMastraServer } from '../../testing/src/mock-mastra-server';
import { getStoredIds } from './contract';
import { mastraHistoryAdapter } from './history-adapter';

const msg = (id: string, role: 'user' | 'assistant'): UIMessage => ({
  id,
  role,
  parts: [{ type: 'text', text: id }],
});

const format = {
  format: 'ai-sdk/v7',
  encode: () => ({}),
  decode: () => ({}) as never,
  getId: () => '',
};

const setup = (remoteId: string | undefined) => {
  const server = createMockMastraServer({ baseUrl: `http://h${Math.random()}.test` });
  const history = mastraHistoryAdapter({
    baseUrl: server.baseUrl,
    agentId: 'chatAgent',
    fetch: server.fetch,
    getRemoteId: () => remoteId,
  });
  return { server, history, endpoint: { baseUrl: server.baseUrl, agentId: 'chatAgent' } };
};

describe('mastraHistoryAdapter', () => {
  it('loads ascending messages with chained parent ids and seeds the stored ids', async () => {
    const { server, history, endpoint } = setup('t1');
    server.seedThread({ id: 't1' }, [msg('u1', 'user'), msg('a1', 'assistant'), msg('u2', 'user')]);

    const repo = await history.withFormat!(format).load();

    expect(repo.headId).toBe('u2');
    expect(repo.messages.map((item) => [item.parentId, (item.message as UIMessage).id])).toEqual([
      [null, 'u1'],
      ['u1', 'a1'],
      ['a1', 'u2'],
    ]);
    expect(getStoredIds(endpoint, 't1')).toEqual(['u1', 'a1', 'u2']);
    expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /chat/chatAgent/threads/t1/messages',
    ]);
  });

  it('merges consecutive assistant messages under the first id, as the server does', async () => {
    const { server, history } = setup('t1');
    server.seedThread({ id: 't1' }, [
      msg('u1', 'user'),
      msg('a1', 'assistant'),
      msg('a1b', 'assistant'),
    ]);
    const repo = await history.withFormat!(format).load();
    expect(repo.messages.map((item) => (item.message as UIMessage).id)).toEqual(['u1', 'a1']);
    expect((repo.messages[1]!.message as UIMessage).parts).toHaveLength(2);
  });

  it('records a thread the server does not know (404) as known empty', async () => {
    const { history, endpoint } = setup('nope');
    await history.withFormat!(format).load();
    expect(getStoredIds(endpoint, 'nope')).toEqual([]);
  });

  it('loads an unknown thread (404) or a thread without a remote id as empty', async () => {
    const missing = setup('nope');
    await expect(missing.history.withFormat!(format).load()).resolves.toEqual({
      headId: null,
      messages: [],
    });
    const draft = setup(undefined);
    await expect(draft.history.withFormat!(format).load()).resolves.toEqual({
      headId: null,
      messages: [],
    });
    expect(draft.server.requests).toEqual([]);
  });

  it('never writes: append, update and delete are no-ops', async () => {
    const { server, history } = setup('t1');
    const formatted = history.withFormat!(format);
    await formatted.append({ parentId: null, message: msg('u1', 'user') });
    await formatted.update?.({ parentId: null, message: msg('u1', 'user') }, 'u1');
    await formatted.delete?.([{ parentId: null, message: msg('u1', 'user') }]);
    await history.append({ parentId: null, message: {} as never });
    expect(server.requests).toEqual([]);
  });

  it('rejects other errors (for example 403)', async () => {
    const { server, history } = setup('t1');
    server.seedThread({ id: 't1', resourceId: 'bob' });
    await expect(history.withFormat!(format).load()).rejects.toMatchObject({ status: 403 });
  });

  for (const [label, failure] of [
    ['a 5xx', { status: 500 }],
    ['a network error', 'network'],
  ] as const) {
    it(`leaves the stored state unknown when the load fails (${label})`, async () => {
      const { server, history, endpoint } = setup('t1');
      server.seedThread({ id: 't1' }, [msg('u1', 'user'), msg('a1', 'assistant')]);
      server.failNext({ path: '/chat/chatAgent/threads/t1/messages' }, failure);
      await expect(history.withFormat!(format).load()).rejects.toBeDefined();
      expect(getStoredIds(endpoint, 't1')).toBeUndefined();
    });
  }
});
