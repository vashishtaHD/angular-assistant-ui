import { describe, expect, it } from 'vitest';
import { bearer, createTestServer, userMessage } from '../../testing/harness';
import { textStep, toolCallStep } from '../../testing/mock-model';

const A = bearer('user-a');
const B = bearer('user-b');
const json = { 'content-type': 'application/json' };

describe('stock Mastra endpoints are locked down', () => {
  const body = JSON.stringify({
    messages: [userMessage('u1', 'hi')],
    memory: { thread: 'stock-thread' },
    system: 'PIRATE',
    requireToolApproval: false,
    clientTools: { bookMeeting: { description: 'EVIL' } },
  });

  it.each([
    ['POST', '/api/agents/chatAgent/stream'],
    ['POST', '/api/agents/chatAgent/generate'],
    ['POST', '/api/agents/chatAgent/stream/ui'],
    ['POST', '/api/agents/chatAgent/resume-stream'],
    ['GET', '/api/agents'],
    ['GET', '/api/agents/chatAgent'],
    ['POST', '/api/memory/save-messages'],
    ['GET', '/api/memory/threads/t1/messages'],
    ['POST', '/api/tools/getWeather/execute'],
    ['GET', '/api/workflows'],
  ])('rejects %s %s for an authenticated user', async (method, path) => {
    const t = await createTestServer();
    const res = await t.request(path, {
      method,
      headers: { ...json, ...A },
      ...(method === 'POST' && { body }),
    });
    expect(res.status).toBe(403);
    expect(t.sm.calls()).toHaveLength(0);
  });

  it('still allows the thread list and thread CRUD routes', async () => {
    const t = await createTestServer();
    const created = await t.request('/api/memory/threads?agentId=chatAgent', {
      method: 'POST',
      headers: { ...json, ...A },
      body: JSON.stringify({ threadId: 'tc', title: 'x', resourceId: 'ignored' }),
    });
    expect(created.status).toBe(200);
    expect(
      (await t.request('/api/memory/threads?agentId=chatAgent&resourceId=ignored', { headers: A }))
        .status,
    ).toBe(200);
    expect(
      (
        await t.request('/api/memory/threads/tc?agentId=chatAgent&resourceId=ignored', {
          headers: A,
        })
      ).status,
    ).toBe(200);
    const patched = await t.request('/api/memory/threads/tc?agentId=chatAgent&resourceId=ignored', {
      method: 'PATCH',
      headers: { ...json, ...A },
      body: JSON.stringify({ title: 'y' }),
    });
    expect(patched.status).toBe(200);
    const deleted = await t.request('/api/memory/threads/tc?agentId=chatAgent&resourceId=ignored', {
      method: 'DELETE',
      headers: A,
    });
    expect(deleted.status).toBe(200);
  });

  it('does not let another user create a thread over an existing thread id', async () => {
    const t = await createTestServer();
    await t.post({ messages: [userMessage('u1', 'mine')], memory: { thread: 'ta' } }, A);
    const res = await t.request('/api/memory/threads?agentId=chatAgent', {
      method: 'POST',
      headers: { ...json, ...B },
      body: JSON.stringify({ threadId: 'ta', title: 'stolen', resourceId: 'user-b' }),
    });
    expect(res.status).not.toBe(200);
    const own = await t.request('/api/memory/threads/ta?agentId=chatAgent&resourceId=ignored', {
      headers: A,
    });
    expect(((await own.json()) as any).resourceId).toBe('user-a');
  });
});

describe('every mounted route', () => {
  const body = JSON.stringify({ messages: [userMessage('u1', 'hi')], memory: { thread: 'walk' } });

  /** The routes the app may serve to an authenticated caller (see `isAllowedRoute`). */
  const ALLOWED = new Set([
    'POST /chat/:agentId',
    'GET /chat/:agentId/threads/:threadId/messages',
    'GET /api/memory/threads',
    'POST /api/memory/threads',
    'GET /api/memory/threads/:threadId',
    'PATCH /api/memory/threads/:threadId',
    'DELETE /api/memory/threads/:threadId',
  ]);

  /** Every concrete method/path pair the Hono app registered (middleware excluded). */
  const mountedRoutes = async () => {
    const t = await createTestServer();
    const seen = new Set<string>();
    for (const route of t.app.routes) {
      if (route.method === 'ALL' || route.path.includes('*')) continue;
      seen.add(`${route.method} ${route.path}`);
    }
    return { t, routes: [...seen].sort() };
  };

  const concrete = (path: string) =>
    path.replace(/:([A-Za-z0-9_]+)(\{[^}]*\})?\??/g, (_, name: string) =>
      name === 'agentId' ? 'chatAgent' : `probe-${name}`,
    );

  it('mounts many stock routes and every allowed route', async () => {
    const { routes } = await mountedRoutes();
    expect(routes.length).toBeGreaterThan(50);
    for (const allowed of ALLOWED) expect(routes).toContain(allowed);
  });

  /**
   * Mastra framework routes that skip auth by design. None runs an agent, a tool or a workflow, or
   * reads stored data: a health check, auth discovery (`me` answers `null` without a session) and
   * login/session flows that answer 400/404 because this app configures no credentials, SSO or
   * sessions. A new public route fails the walks below until it is reviewed and listed here.
   */
  const FRAMEWORK_PUBLIC: Record<string, number[]> = {
    'GET /health': [200],
    'GET /.well-known/oauth-protected-resource': [200],
    'GET /.well-known/oauth-protected-resource/api/mcp': [200],
    'GET /api/auth/capabilities': [200],
    'GET /api/auth/me': [200],
    'GET /api/auth/sso/callback': [400],
    'GET /api/auth/sso/login': [404],
    'POST /api/auth/credentials/sign-in': [400, 404],
    'POST /api/auth/credentials/sign-up': [400, 404],
    'POST /api/auth/logout': [404],
    'POST /api/auth/refresh': [404],
  };

  /** Requests every route (but OPTIONS/HEAD) and lists those whose status is not `expected`. */
  const walk = async (headers: Record<string, string>, expected: number, skipAllowed: boolean) => {
    const { t, routes } = await mountedRoutes();
    const unexpected: string[] = [];
    for (const route of routes) {
      if (skipAllowed && ALLOWED.has(route)) continue;
      const [method, path] = route.split(' ') as [string, string];
      if (method === 'OPTIONS' || method === 'HEAD') continue;
      const res = await t.request(concrete(path), {
        method,
        headers: { ...json, ...headers },
        ...(method !== 'GET' && method !== 'DELETE' && { body }),
      });
      const accepted = FRAMEWORK_PUBLIC[route] ?? [expected];
      if (!accepted.includes(res.status)) unexpected.push(`${route} -> ${res.status}`);
    }
    return { t, unexpected };
  };

  it('answers 403 to an authenticated caller on every route outside the allow-list', async () => {
    const { t, unexpected } = await walk(A, 403, true);
    expect(unexpected).toEqual([]);
    expect(t.sm.calls()).toHaveLength(0);
  }, 60000);

  it('answers 401 without credentials on every route, including the allowed ones', async () => {
    const { t, unexpected } = await walk({}, 401, false);
    expect(unexpected).toEqual([]);
    expect(t.sm.calls()).toHaveLength(0);
  }, 60000);
});

describe('client message ids cannot touch another user', () => {
  it('a user message id reused by another user does not overwrite the original', async () => {
    const t = await createTestServer();
    await t.post(
      { messages: [userMessage('collision', 'A private')], memory: { thread: 'ta' } },
      A,
    );
    const before = (await t.history('ta', A)).body.messages;
    const res = await t.post(
      { messages: [userMessage('collision', 'B overwrite')], memory: { thread: 'tb' } },
      B,
    );
    expect(res.status).toBe(200);
    const after = (await t.history('ta', A)).body.messages;
    expect(after).toEqual(before);
    expect(after[0].id).toBe('collision');
    expect(after[0].parts[0].text).toBe('A private');
    const mine = (await t.history('tb', B)).body.messages;
    // The client still sees its own id back.
    expect(mine[0]).toMatchObject({ id: 'collision', role: 'user' });
    expect(mine[0].parts[0].text).toBe('B overwrite');
    expect((await t.history('ta', B)).status).toBe(403);
  });

  it('the same id in two threads of one user stays separate, and a resend dedupes', async () => {
    const t = await createTestServer();
    await t.post({ messages: [userMessage('same', 'one')], memory: { thread: 't1' } }, A);
    await t.post({ messages: [userMessage('same', 'two')], memory: { thread: 't2' } }, A);
    expect((await t.history('t1', A)).body.messages[0].parts[0].text).toBe('one');
    expect((await t.history('t2', A)).body.messages[0].parts[0].text).toBe('two');
    await t.post(
      { messages: [userMessage('same', 'one')], messageIds: ['same'], memory: { thread: 't1' } },
      A,
    );
    const ids = (await t.history('t1', A)).body.messages.map((m: any) => m.id);
    expect(ids[0]).toBe('same');
    expect(ids.filter((id: string) => id === 'same')).toHaveLength(1);
  });

  it('rejects an assistant message id that belongs to another user, and never changes it', async () => {
    const t = await createTestServer({
      steps: [toolCallStep('askUser', { question: 'Which?' }, 'call-2')],
    });
    const first = await t.post(
      { messages: [userMessage('u1', 'ask')], memory: { thread: 'ta' } },
      A,
    );
    const assistantId = first.chunks.find((c) => c.type === 'start')!['messageId'];
    const before = (await t.history('ta', A)).body.messages;
    const res = await t.post(
      {
        messages: [
          {
            id: assistantId,
            role: 'assistant',
            parts: [
              {
                type: 'tool-askUser',
                toolCallId: 'call-2',
                state: 'output-available',
                input: { question: 'Which?' },
                output: { answer: 'HACKED' },
              },
            ],
          },
        ],
        memory: { thread: 'tb' },
      },
      B,
    );
    expect(res.status).toBe(409);
    expect((await t.history('ta', A)).body.messages).toEqual(before);
  });

  it('reconciliation only ever deletes inside the callers own thread', async () => {
    const t = await createTestServer({ steps: [textStep('a'), textStep('b'), textStep('c')] });
    await t.post(
      { messages: [userMessage('x1', 'A one')], messageIds: ['x1'], memory: { thread: 'ta' } },
      A,
    );
    const before = (await t.history('ta', A)).body.messages;
    await t.post(
      { messages: [userMessage('y1', 'B one')], messageIds: ['y1'], memory: { thread: 'tb' } },
      B,
    );
    await t.post(
      { messages: [userMessage('z1', 'B two')], messageIds: ['z1'], memory: { thread: 'tb' } },
      B,
    );
    expect((await t.history('ta', A)).body.messages).toEqual(before);
    expect((await t.history('tb', B)).body.messages.map((m: any) => m.id)[0]).toBe('z1');
  });
});
