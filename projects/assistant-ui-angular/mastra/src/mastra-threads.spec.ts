import { AuiConfig, type AssistantClient } from '@assistant-ui/store/client';
import type { UIMessage, UIMessageChunk } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountAui, type MountedAui } from '../../src/testing-internal/mastra-host';
import {
  createMockMastraServer,
  type MockMastraChatTurn,
  type MockMastraReply,
  type MockMastraServer,
  type MockMastraServerOptions,
} from '../../testing/src/mock-mastra-server';
import { MASTRA_AUTH } from './auth.token';
import { MastraThreads } from './mastra-threads';
import { mastraThreadListAdapter } from './thread-list-adapter';
import { createMastraTransport } from './transport';

const AGENT = 'chatAgent';

const user = (id: string, text: string): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
});
const assistant = (id: string, text: string): UIMessage => ({
  id,
  role: 'assistant',
  parts: [{ type: 'text', text }],
});

const textReply = (text: string, delayMs?: number): MockMastraReply => ({
  chunks: [
    { type: 'start-step' },
    { type: 'text-start', id: 't1' },
    ...text.split(' ').map((word, i): UIMessageChunk => ({
      type: 'text-delta',
      id: 't1',
      delta: i === 0 ? word : ` ${word}`,
    })),
    { type: 'text-end', id: 't1' },
    { type: 'finish-step' },
    { type: 'finish', finishReason: 'stop' },
  ],
  ...(delayMs !== undefined && { delayMs }),
});

const messageTexts = (aui: AssistantClient) =>
  aui
    .thread()
    .getState()
    .messages.map((m) =>
      m.content.map((part) => (part.type === 'text' ? part.text : `[${part.type}]`)).join(''),
    );
const messageIds = (aui: AssistantClient) =>
  aui
    .thread()
    .getState()
    .messages.map((m) => m.id);

let mounted: MountedAui | undefined;

afterEach(() => {
  mounted?.destroy();
  mounted = undefined;
});

let servers = 0;

interface SetupOptions extends MockMastraServerOptions {
  pageSize?: number;
  useInjectedAuth?: boolean;
  seed?: (server: MockMastraServer) => void;
}

async function setup(options: SetupOptions = {}) {
  const { pageSize, useInjectedAuth, seed, ...serverOptions } = options;
  // A fresh base URL per test keeps the module-level stored-id registry isolated.
  const server = createMockMastraServer({
    baseUrl: `http://mastra-${++servers}.test`,
    ...serverOptions,
  });
  seed?.(server);
  mounted = await mountAui(
    () =>
      AuiConfig({
        threads: MastraThreads({
          adapter: mastraThreadListAdapter({
            baseUrl: server.baseUrl,
            agentId: AGENT,
            fetch: server.fetch,
            titlePolling: { intervalMs: 20, timeoutMs: 2000 },
            ...(pageSize !== undefined && { pageSize }),
          }),
          transport: () =>
            createMastraTransport({ api: server.baseUrl, agentId: AGENT, fetch: server.fetch }),
        }),
      }),
    useInjectedAuth
      ? [
          {
            provide: MASTRA_AUTH,
            useValue: { getHeaders: () => ({ Authorization: 'Bearer tok' }) },
          },
        ]
      : [],
  );
  const { aui } = mounted;
  await aui.threads().getLoadThreadsPromise();
  const chatRequests = () =>
    server.requests.filter((r) => r.method === 'POST' && r.path === `/chat/${AGENT}`);
  const historyRequests = (threadId: string) =>
    server.requests.filter((r) => r.path === `/chat/${AGENT}/threads/${threadId}/messages`);
  const send = (text: string) => {
    aui.thread().composer().setText(text);
    aui.thread().composer().send();
  };
  const idle = () => mounted!.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
  return { server, aui, mounted, chatRequests, historyRequests, send, idle };
}

const seedTwoThreads = (server: MockMastraServer) => {
  server.seedThread({ id: 't1', title: 'First', updatedAt: '2026-01-01T00:00:00.000Z' }, [
    user('u1', 'hello one'),
    assistant('a1', 'reply one'),
  ]);
  server.seedThread({ id: 't2', title: 'Second', updatedAt: '2026-01-02T00:00:00.000Z' }, [
    user('u2', 'hello two'),
    assistant('a2', 'reply two'),
  ]);
};

describe('MastraThreads over the Mastra contract', () => {
  it('lists the server threads newest first and loads the next page', async () => {
    const { aui, server } = await setup({
      pageSize: 2,
      seed: (s) => {
        s.seedThread({ id: 'old', title: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' });
        s.seedThread({ id: 'mid', title: 'Mid', updatedAt: '2026-01-02T00:00:00.000Z' });
        s.seedThread({ id: 'new', title: 'New', updatedAt: '2026-01-03T00:00:00.000Z' });
      },
    });

    expect(aui.threads().getState().threadIds).toEqual(['new', 'mid']);
    expect(aui.threads().getState().hasMore).toBe(true);

    await aui.threads().loadMore();

    expect(aui.threads().getState().threadIds).toEqual(['new', 'mid', 'old']);
    expect(aui.threads().getState().hasMore).toBe(false);
    const pages = server.requests
      .filter((r) => r.method === 'GET' && r.path === '/api/memory/threads')
      .map((r) => [r.query.get('page'), r.query.get('perPage'), r.query.get('orderBy[field]')]);
    expect(pages).toEqual([
      ['0', '2', 'updatedAt'],
      ['1', '2', 'updatedAt'],
    ]);
  });

  it('maps metadata.archived to the archived list', async () => {
    const { aui } = await setup({
      seed: (s) => {
        s.seedThread({ id: 'live', metadata: { archived: false } });
        s.seedThread({ id: 'gone', metadata: { archived: true } });
      },
    });
    expect(aui.threads().getState().threadIds).toEqual(['live']);
    expect(aui.threads().getState().archivedThreadIds).toEqual(['gone']);
  });

  it('archives by PATCHing metadata.archived=true and keeps the other metadata keys', async () => {
    const { aui, server, mounted } = await setup({
      seed: (s) => s.seedThread({ id: 't1', metadata: { archived: false, color: 'red' } }),
    });

    aui.threads().item({ id: 't1' }).archive();

    await mounted.waitFor(() =>
      expect(server.threads().find((t) => t.id === 't1')?.metadata).toEqual({
        archived: true,
        color: 'red',
      }),
    );
    const patch = server.requests.find((r) => r.method === 'PATCH');
    expect(patch?.path).toBe('/api/memory/threads/t1');
    expect(patch?.body).toEqual({ metadata: { archived: true, color: 'red' } });
    await mounted.waitFor(() => expect(aui.threads().getState().archivedThreadIds).toEqual(['t1']));
  });

  it("loads a thread's history once; switching back does not refetch", async () => {
    const { aui, mounted, historyRequests } = await setup({ seed: seedTwoThreads });

    aui.threads().switchToThread('t1');
    await mounted.waitFor(() => expect(messageTexts(aui)).toEqual(['hello one', 'reply one']));
    aui.threads().switchToThread('t2');
    await mounted.waitFor(() => expect(messageTexts(aui)).toEqual(['hello two', 'reply two']));
    aui.threads().switchToThread('t1');
    await mounted.waitFor(() => expect(messageTexts(aui)).toEqual(['hello one', 'reply one']));

    expect(historyRequests('t1')).toHaveLength(1);
    expect(historyRequests('t2')).toHaveLength(1);
  });

  it('never writes messages through the history adapter', async () => {
    const { aui, server, mounted, send, idle } = await setup({ seed: seedTwoThreads });
    aui.threads().switchToThread('t1');
    await mounted.waitFor(() => expect(messageIds(aui)).toEqual(['u1', 'a1']));

    send('more');
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toBe('Echo: more'));
    await idle();

    const writes = server.requests.filter((r) => r.method !== 'GET');
    expect(writes.map((r) => `${r.method} ${r.path}`)).toEqual([`POST /chat/${AGENT}`]);
  });

  it('keeps chunks of a run in its own thread when switching mid-stream', async () => {
    const { aui, server, mounted, send } = await setup({
      seed: seedTwoThreads,
      respond: () => textReply('one two three four five six seven eight', 25),
    });
    aui.threads().switchToThread('t1');
    await mounted.waitFor(() => expect(messageIds(aui)).toEqual(['u1', 'a1']));
    aui.threads().switchToThread('t2');
    await mounted.waitFor(() => expect(messageIds(aui)).toEqual(['u2', 'a2']));
    aui.threads().switchToThread('t1');
    await mounted.waitFor(() => expect(messageIds(aui)).toEqual(['u1', 'a1']));

    send('stream please');
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(true));
    aui.threads().switchToThread('t2');
    await mounted.waitFor(() => expect(messageIds(aui)).toEqual(['u2', 'a2']));

    // Let the t1 run finish on the server while t2 is visible.
    await mounted.waitFor(() => expect(server.messages('t1')).toHaveLength(4));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(messageTexts(aui)).toEqual(['hello two', 'reply two']);

    aui.threads().switchToThread('t1');
    await mounted.waitFor(() =>
      expect(messageTexts(aui)).toEqual([
        'hello one',
        'reply one',
        'stream please',
        'one two three four five six seven eight',
      ]),
    );
  });

  it('sends only the new messages and the active branch ids after an edit', async () => {
    const { aui, server, mounted, chatRequests, idle } = await setup({
      seed: (s) =>
        s.seedThread({ id: 't1' }, [
          user('u1', 'first'),
          assistant('a1', 'reply one'),
          user('u2', 'second'),
          assistant('a2', 'reply two'),
        ]),
    });
    aui.threads().switchToThread('t1');
    await mounted.waitFor(() => expect(messageIds(aui)).toEqual(['u1', 'a1', 'u2', 'a2']));

    const edit = aui.thread().message({ index: 2 }).composer();
    edit.beginEdit();
    edit.setText('second, edited');
    edit.send();
    await mounted.waitFor(() =>
      expect(messageTexts(aui)).toEqual([
        'first',
        'reply one',
        'second, edited',
        'Echo: second, edited',
      ]),
    );
    await idle();

    const editedId = messageIds(aui)[2]!;
    expect(editedId).not.toBe('u2');
    const body = chatRequests().at(-1)!.body as { messages: UIMessage[]; messageIds: string[] };
    expect(body.messageIds).toEqual(['u1', 'a1', editedId]);
    expect(body.messages.map((m) => m.id)).toEqual([editedId]);
    // The server dropped the old branch and stored the new one.
    expect(server.messages('t1').map((m) => m.id)).toEqual([
      'u1',
      'a1',
      editedId,
      messageIds(aui)[3],
    ]);

    // The next send carries only the new user message.
    aui.thread().composer().setText('third');
    aui.thread().composer().send();
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toBe('Echo: third'));
    await idle();
    const next = chatRequests().at(-1)!.body as { messages: UIMessage[]; messageIds: string[] };
    expect(next.messageIds).toEqual(messageIds(aui).slice(0, 5));
    expect(next.messages.map((m) => m.id)).toEqual([messageIds(aui)[4]]);
  });

  it('adds the MASTRA_AUTH headers to every chat and memory request', async () => {
    const { aui, server, mounted, send, idle } = await setup({
      tokens: { tok: 'alice' },
      useInjectedAuth: true,
      seed: (s) =>
        s.seedThread({ id: 't1', resourceId: 'alice' }, [user('u1', 'hi'), assistant('a1', 'yo')]),
    });
    aui.threads().switchToThread('t1');
    await mounted.waitFor(() => expect(messageIds(aui)).toEqual(['u1', 'a1']));
    aui.threads().item({ id: 't1' }).rename('Renamed');
    send('hello');
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toBe('Echo: hello'));
    await idle();
    aui.threads().switchToNewThread();
    await mounted.waitFor(() => expect(aui.thread().getState().messages).toHaveLength(0));
    send('new thread');
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toBe('Echo: new thread'));
    await idle();

    const kinds = new Set(server.requests.map((r) => `${r.method} ${r.path.split('/')[1]}`));
    expect(kinds).toEqual(new Set(['GET api', 'GET chat', 'PATCH api', 'POST chat', 'POST api']));
    for (const request of server.requests) {
      expect(request.headers['authorization'], `${request.method} ${request.path}`).toBe(
        'Bearer tok',
      );
    }
    expect(server.threads().every((t) => t.resourceId === 'alice')).toBe(true);
  });

  it('reconciles the sends of a thread it created (known empty, not unknown)', async () => {
    const { aui, mounted, chatRequests, send, idle } = await setup();

    send('one');
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toBe('Echo: one'));
    await idle();
    send('two');
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toBe('Echo: two'));
    await idle();

    const [first, second] = chatRequests().map(
      (r) => r.body as { messages: UIMessage[]; messageIds?: string[] },
    );
    const ids = messageIds(aui);
    expect(first!.messageIds).toEqual([ids[0]]);
    expect(second!.messageIds).toEqual(ids.slice(0, 3));
    expect(second!.messages.map((m) => m.id)).toEqual([ids[2]]);
  });

  it('creates a new thread with metadata.archived=false and titles it once Mastra has', async () => {
    const { aui, server, mounted, send, idle } = await setup({ title: false });

    send('Plan a trip to Paris');
    await mounted.waitFor(() =>
      expect(messageTexts(aui).at(-1)).toBe('Echo: Plan a trip to Paris'),
    );
    await idle();
    const [created] = server.threads();
    expect(created?.metadata).toEqual({ archived: false });
    const create = server.requests.find(
      (r) => r.method === 'POST' && r.path === '/api/memory/threads',
    );
    expect(create?.body).toMatchObject({ threadId: created!.id, metadata: { archived: false } });

    setTimeout(() => server.setTitle(created!.id, 'Trip to Paris'), 100);
    await mounted.waitFor(() =>
      expect(
        aui.threads().item({ id: aui.threads().getState().mainThreadId }).getState().title,
      ).toBe('Trip to Paris'),
    );
  });

  it('resubmits automatically after an approval answer', async () => {
    const turns: MockMastraChatTurn[] = [];
    const { aui, mounted, chatRequests } = await setup({
      respond: (turn) => {
        turns.push(turn);
        if (!turn.isResubmit) {
          return {
            chunks: [
              { type: 'start-step' },
              {
                type: 'tool-input-available',
                toolCallId: 'call-b',
                toolName: 'bookMeeting',
                input: { title: 'Sync', when: 'Monday' },
              },
              { type: 'tool-approval-request', approvalId: 'run-1::call-b', toolCallId: 'call-b' },
            ],
          };
        }
        return {
          chunks: [
            {
              type: 'tool-output-available',
              toolCallId: 'call-b',
              output: { confirmed: true, title: 'Sync', when: 'Monday' },
            },
            { type: 'finish-step' },
            ...textReply('Booked.').chunks,
          ],
        };
      },
    });

    aui.thread().composer().setText('Book a sync on Monday');
    aui.thread().composer().send();
    const part = () => aui.thread().message({ index: 1 }).part({ toolCallId: 'call-b' });
    await mounted.waitFor(() =>
      expect(part().getState()).toMatchObject({ type: 'tool-call', toolName: 'bookMeeting' }),
    );
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));
    expect(chatRequests()).toHaveLength(1);

    await part().respondToToolApproval({ approved: true });

    await mounted.waitFor(() => expect(chatRequests()).toHaveLength(2));
    const body = chatRequests()[1]!.body as { messages: UIMessage[] };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]).toMatchObject({
      role: 'assistant',
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-bookMeeting',
          state: 'approval-responded',
          approval: expect.objectContaining({ id: 'run-1::call-b', approved: true }),
        }),
      ]),
    });
    expect(turns[1]?.isResubmit).toBe(true);
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toContain('Booked.'));
    // Done: no further automatic resubmit.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(chatRequests()).toHaveLength(2);
  });

  it('resubmits automatically after an ask-user result', async () => {
    const { aui, mounted, chatRequests } = await setup({
      respond: (turn) =>
        turn.isResubmit
          ? textReply('Blue it is.')
          : {
              chunks: [
                { type: 'start-step' },
                {
                  type: 'tool-input-available',
                  toolCallId: 'call-q',
                  toolName: 'askUser',
                  input: { question: 'Favourite colour?', options: ['Blue', 'Red'] },
                },
                { type: 'finish-step' },
                { type: 'finish', finishReason: 'tool-calls' },
              ],
            },
    });

    aui.thread().composer().setText('Ask me something');
    aui.thread().composer().send();
    const part = () => aui.thread().message({ index: 1 }).part({ toolCallId: 'call-q' });
    await mounted.waitFor(() => expect(part().getState()).toMatchObject({ toolName: 'askUser' }));
    await mounted.waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    part().addToolResult({ answer: 'Blue' });

    await mounted.waitFor(() => expect(chatRequests()).toHaveLength(2));
    const body = chatRequests()[1]!.body as { messages: UIMessage[] };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]!.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-askUser',
          state: 'output-available',
          output: { answer: 'Blue' },
        }),
      ]),
    );
    await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toContain('Blue it is.'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(chatRequests()).toHaveLength(2);
  });

  describe('after a failed history load', () => {
    const stored = [
      user('u1', 'first'),
      assistant('a1', 'reply one'),
      user('u2', 'second'),
      assistant('a2', 'reply two'),
    ];

    for (const [label, failure] of [
      ['a 5xx', { status: 503, body: { error: 'Service Unavailable' } }],
      ['a network error', 'network'],
    ] as const) {
      it(`does not erase the stored thread on the next send (${label})`, async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
          const { aui, server, mounted, chatRequests, historyRequests, send, idle } = await setup({
            seed: (s) => {
              s.seedThread({ id: 't1' }, stored);
              s.failNext({ method: 'GET', path: `/chat/${AGENT}/threads/t1/messages` }, failure);
            },
          });
          aui.threads().switchToThread('t1');
          await mounted.waitFor(() => expect(historyRequests('t1')).toHaveLength(1));
          await mounted.waitFor(() => expect(aui.thread().getState().isLoading).toBe(false));
          expect(messageIds(aui)).toEqual([]);

          send('after the failure');
          await mounted.waitFor(() =>
            expect(messageTexts(aui).at(-1)).toBe('Echo: after the failure'),
          );
          await idle();

          // The server kept the conversation it could not show and appended the new turn.
          const ids = server.messages('t1').map((m) => m.id);
          expect(ids.slice(0, 4)).toEqual(['u1', 'a1', 'u2', 'a2']);
          expect(ids).toHaveLength(6);
          // Unknown stored state: no messageIds, so the server does not reconcile.
          expect(chatRequests().at(-1)!.body).not.toHaveProperty('messageIds');

          // It stays unknown until the history loads again: the next send does not reconcile.
          send('and again');
          await mounted.waitFor(() => expect(messageTexts(aui).at(-1)).toBe('Echo: and again'));
          await idle();
          expect(chatRequests().at(-1)!.body).not.toHaveProperty('messageIds');
          expect(server.messages('t1')).toHaveLength(8);
          expect(consoleError).toHaveBeenCalled();
        } finally {
          consoleError.mockRestore();
        }
      });
    }
  });
});
