import { describe, expect, it } from 'vitest';
import { createMockMastraServer } from '../../testing/src/mock-mastra-server';
import { MastraHttpError, getStoredIds, setStoredIds } from './contract';
import { mastraThreadListAdapter } from './thread-list-adapter';

const readText = async (stream: ReadableStream<{ type: string; textDelta?: string }>) => {
  let text = '';
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    if (value.type === 'text-delta') text += value.textDelta ?? '';
  }
};

const setup = (options: Parameters<typeof createMockMastraServer>[0] = {}, pageSize?: number) => {
  const server = createMockMastraServer(options);
  const adapter = mastraThreadListAdapter({
    baseUrl: server.baseUrl,
    agentId: 'chatAgent',
    fetch: server.fetch,
    titlePolling: { intervalMs: 10, timeoutMs: 300 },
    ...(pageSize !== undefined && { pageSize }),
  });
  return { server, adapter };
};

describe('mastraThreadListAdapter', () => {
  it('maps threads (title, archived, custom metadata, lastMessageAt) and pages with nextCursor', async () => {
    const { server, adapter } = setup({}, 1);
    server.seedThread({
      id: 'a',
      title: '',
      updatedAt: '2026-01-02T00:00:00.000Z',
      metadata: { archived: true, color: 'red' },
    });
    server.seedThread({ id: 'b', title: 'Bee', updatedAt: '2026-01-01T00:00:00.000Z' });

    const first = await adapter.list();
    expect(first).toEqual({
      threads: [
        {
          status: 'archived',
          remoteId: 'a',
          lastMessageAt: new Date('2026-01-02T00:00:00.000Z'),
          custom: { color: 'red' },
        },
      ],
      nextCursor: '1',
    });
    const second = await adapter.list({ after: first.nextCursor });
    expect(second).toEqual({
      threads: [
        {
          status: 'regular',
          remoteId: 'b',
          title: 'Bee',
          lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });
  });

  it('defaults to pages of 20', async () => {
    const { server, adapter } = setup();
    await adapter.list();
    expect(server.requests[0]?.query.get('perPage')).toBe('20');
    expect(server.requests[0]?.query.get('agentId')).toBe('chatAgent');
  });

  it('initializes with metadata.archived=false plus draft custom data; the remote id is the thread id', async () => {
    const { server, adapter } = setup();
    await expect(adapter.initialize('t1', { custom: { pinned: true } })).resolves.toEqual({
      remoteId: 't1',
      externalId: undefined,
    });
    const post = server.requests.at(-1)!;
    expect(post.query.get('agentId')).toBe('chatAgent');
    expect(post.body).toEqual({
      threadId: 't1',
      resourceId: 'server-derived',
      metadata: { pinned: true, archived: false },
    });
    expect(server.threads()[0]).toMatchObject({ id: 't1', resourceId: 'dev-user' });
  });

  it('renames, unarchives and replaces custom data while keeping the archived flag', async () => {
    const { server, adapter } = setup();
    server.seedThread({ id: 't1', metadata: { archived: true, color: 'red' } });

    await adapter.rename('t1', 'New name');
    await adapter.updateCustom!('t1', { color: 'blue' });
    expect(server.threads()[0]).toMatchObject({
      title: 'New name',
      metadata: { color: 'blue', archived: true },
    });

    await adapter.unarchive!('t1');
    expect(server.threads()[0]?.metadata).toEqual({ color: 'blue', archived: false });

    await adapter.updateCustom!('t1', undefined);
    expect(server.threads()[0]?.metadata).toEqual({ archived: false });
  });

  it('deletes the thread and forgets its stored ids', async () => {
    const { server, adapter } = setup();
    server.seedThread({ id: 't1' });
    const endpoint = { baseUrl: server.baseUrl, agentId: 'chatAgent' };
    setStoredIds(endpoint, 't1', ['u1']);
    await adapter.delete('t1');
    expect(server.threads()).toEqual([]);
    expect(getStoredIds(endpoint, 't1')).toEqual([]);
    expect(server.requests.at(-1)).toMatchObject({
      method: 'DELETE',
      path: '/api/memory/threads/t1',
    });
  });

  it('fetches one thread and rejects a missing one with MastraHttpError 404', async () => {
    const { server, adapter } = setup();
    server.seedThread({ id: 't1', title: 'One' });
    await expect(adapter.fetch('t1')).resolves.toMatchObject({ remoteId: 't1', title: 'One' });
    const error = await adapter.fetch('nope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MastraHttpError);
    expect(error).toMatchObject({ status: 404 });
  });

  it('rejects another user’s thread with 403', async () => {
    const { server, adapter } = setup();
    server.seedThread({ id: 't1', resourceId: 'bob' });
    await expect(adapter.rename('t1', 'x')).rejects.toMatchObject({ status: 403 });
  });

  it('generateTitle resolves with the title once the server has set it', async () => {
    const { server, adapter } = setup({ title: false });
    server.seedThread({ id: 't1' });
    setTimeout(() => server.setTitle('t1', 'Weekend plans'), 50);
    const stream = await adapter.generateTitle('t1', []);
    await expect(readText(stream as never)).resolves.toBe('Weekend plans');
    expect(
      server.requests.filter((r) => r.path === '/api/memory/threads/t1').length,
    ).toBeGreaterThan(1);
  });

  it('generateTitle gives up without a title after the timeout', async () => {
    const { server, adapter } = setup({ title: false });
    server.seedThread({ id: 't1' });
    const started = Date.now();
    await expect(readText((await adapter.generateTitle('t1', [])) as never)).resolves.toBe('');
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('sends the explicit auth headers and credentials', async () => {
    const server = createMockMastraServer({ tokens: { tok: 'alice' } });
    const seen: RequestInit[] = [];
    const adapter = mastraThreadListAdapter({
      baseUrl: server.baseUrl,
      agentId: 'chatAgent',
      auth: { getHeaders: () => ({ Authorization: 'Bearer tok' }), credentials: 'include' },
      fetch: (input, init) => {
        seen.push(init ?? {});
        return server.fetch(input, init);
      },
    });
    await adapter.list();
    expect(server.requests[0]?.headers['authorization']).toBe('Bearer tok');
    expect(seen[0]?.credentials).toBe('include');
  });
});
