import { Injector, runInInjectionContext } from '@angular/core';
import type { UIMessage, UIMessageChunk } from 'ai';
import { describe, expect, it } from 'vitest';
import { createMockMastraServer } from '../../testing/src/mock-mastra-server';
import { MASTRA_AUTH } from './auth.token';
import { getStoredIds, MastraHttpError } from './contract';
import { createMastraTransport, MastraChatTransport } from './transport';

const user = (id: string, text = id): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
});

const readAll = async (stream: ReadableStream<UIMessageChunk>) => {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
};

const setup = (tools?: Parameters<typeof createMastraTransport>[0]['tools']) => {
  const server = createMockMastraServer({ baseUrl: `http://t${Math.random()}.test` });
  const transport = createMastraTransport({
    api: server.baseUrl,
    agentId: 'chatAgent',
    fetch: server.fetch,
    ...(tools !== undefined && { tools }),
  });
  const send = (chatId: string, messages: UIMessage[], body?: object) =>
    transport.sendMessages({
      chatId,
      messages,
      trigger: 'submit-message',
      messageId: undefined,
      abortSignal: undefined,
      ...(body && { body }),
    });
  const lastBody = () =>
    server.requests.filter((r) => r.path === '/chat/chatAgent').at(-1)?.body as Record<
      string,
      unknown
    >;
  return { server, transport, send, lastBody };
};

describe('createMastraTransport', () => {
  it('posts the whitelisted body to <api>/chat/<agentId> and records the stored ids', async () => {
    const { server, send, lastBody } = setup();
    const chunks = await readAll(await send('t1', [user('u1', 'hi')]));
    const start = chunks.find((c) => c.type === 'start') as { messageId: string };

    expect(Object.keys(lastBody()).sort()).toEqual(
      ['memory', 'messageIds', 'messages', 'trigger'].sort(),
    );
    expect(lastBody()).toMatchObject({
      memory: { thread: 't1' },
      messageIds: ['u1'],
      trigger: 'submit-message',
    });
    expect(getStoredIds({ baseUrl: server.baseUrl, agentId: 'chatAgent' }, 't1')).toEqual([
      'u1',
      start.messageId,
    ]);

    const assistant = server.messages('t1')[1]!;
    await readAll(await send('t1', [user('u1', 'hi'), assistant, user('u2')]));
    expect((lastBody()['messages'] as UIMessage[]).map((m) => m.id)).toEqual(['u2']);
    expect(lastBody()['messageIds']).toEqual(['u1', assistant.id, 'u2']);
  });

  it('leaves the stored ids alone when the stream is cancelled', async () => {
    const { server, send } = setup();
    const stream = await send('t2', [user('u1')]);
    await stream.cancel();
    expect(getStoredIds({ baseUrl: server.baseUrl, agentId: 'chatAgent' }, 't2')).toEqual([]);
  });

  it('forwards model-context tools, filtered by the tools option', async () => {
    const tools = {
      pickDate: { description: 'Pick a date', parameters: { type: 'object' } },
      secret: { parameters: { type: 'object' } },
    };
    const all = setup();
    await readAll(await all.send('t1', [user('u1')], { tools }));
    expect(all.lastBody()['tools']).toEqual(tools);

    const none = setup(false);
    await readAll(await none.send('t1', [user('u1')], { tools }));
    expect(none.lastBody()).not.toHaveProperty('tools');

    const some = setup((t) => ({ pickDate: t['pickDate']! }));
    await readAll(await some.send('t1', [user('u1')], { tools }));
    expect(some.lastBody()['tools']).toEqual({ pickDate: tools.pickDate });
  });

  it('does not forward other body fields (system, config)', async () => {
    const { send, lastBody } = setup();
    await readAll(await send('t1', [user('u1')], { system: 'be evil', config: { x: 1 } }));
    expect(lastBody()).not.toHaveProperty('system');
    expect(lastBody()).not.toHaveProperty('config');
  });

  it('surfaces a 409 (assistant id from another thread) as an error', async () => {
    const { server, send } = setup();
    await readAll(await send('t1', [user('u1')]));
    const foreign = server.messages('t1')[1]!;
    await expect(send('t2', [user('u9'), foreign])).rejects.toThrow(/Message id already in use/);
    expect(server.requests.filter((r) => r.path === '/chat/chatAgent')).toHaveLength(2);
  });

  it('reads MASTRA_AUTH in an injection context and keeps it on clones', async () => {
    const server = createMockMastraServer({ tokens: { tok: 'alice' } });
    const injector = Injector.create({
      providers: [
        {
          provide: MASTRA_AUTH,
          useValue: { getHeaders: async () => ({ Authorization: 'Bearer tok' }) },
        },
      ],
    });
    const transport = runInInjectionContext(injector, () =>
      createMastraTransport({ api: server.baseUrl, agentId: 'chatAgent', fetch: server.fetch }),
    );
    const clone = transport.__internal_clone();
    expect(clone).toBeInstanceOf(MastraChatTransport);
    await readAll(
      await clone.sendMessages({
        chatId: 't1',
        messages: [user('u1')],
        trigger: 'submit-message',
        messageId: undefined,
        abortSignal: undefined,
      }),
    );
    expect(server.requests.at(-1)?.headers['authorization']).toBe('Bearer tok');
    expect(server.threads()[0]?.resourceId).toBe('alice');
  });

  it('fails with the server error without auth in token mode', async () => {
    const server = createMockMastraServer({ tokens: { tok: 'alice' } });
    const transport = createMastraTransport({
      api: server.baseUrl,
      agentId: 'chatAgent',
      fetch: server.fetch,
    });
    await expect(
      transport.sendMessages({
        chatId: 't1',
        messages: [user('u1')],
        trigger: 'submit-message',
        messageId: undefined,
        abortSignal: undefined,
      }),
    ).rejects.toThrow(/Invalid or expired token/);
    expect(MastraHttpError).toBeDefined();
  });
});
