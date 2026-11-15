// Original (no upstream counterpart): an in-memory mock of the Mastra server for tests.
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai';

/** A memory thread held by {@link createMockMastraServer}. */
export interface MockMastraThread {
  id: string;
  resourceId: string;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** A request the mock server received. */
export interface MockMastraRequest {
  method: string;
  /** Path without the base URL or query, e.g. `/api/memory/threads/t1`. */
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  /** Parsed JSON body, if any. */
  body: unknown;
}

/** What the chat route passes to the `respond` script. */
export interface MockMastraChatTurn {
  agentId: string;
  threadId: string;
  userId: string;
  /** The validated request body. */
  body: {
    messages: UIMessage[];
    messageIds?: string[];
    memory: { thread: string };
    trigger?: string;
    messageId?: string;
    resumeData?: Record<string, unknown>;
    runId?: string;
    tools?: Record<string, { description?: string; parameters: Record<string, unknown> }>;
  };
  /** True when the last message is an assistant message (an approval or tool-result resubmit). */
  isResubmit: boolean;
  /** The thread's stored messages after reconciliation and the sent messages. */
  stored: UIMessage[];
  /** Frontend tools the route would use (server-tool collisions and bad names removed). */
  clientTools: string[];
}

/** One scripted reply: the UI message chunks after `start` (the server adds `start`). */
export interface MockMastraReply {
  chunks: UIMessageChunk[];
  /** Delay before each chunk, in ms. */
  delayMs?: number;
}

/** Options for {@link createMockMastraServer}. */
export interface MockMastraServerOptions {
  /** Base URL the mock answers. Default `http://mastra.test`. */
  baseUrl?: string;
  /** Agent ids the server knows. Default `['chatAgent']`. */
  agents?: string[];
  /** Server tool names (frontend tools with these names are dropped). Default the demo tools. */
  serverTools?: string[];
  /**
   * Token mode: bearer token to user id. Requests without a known `Authorization: Bearer <token>`
   * get 401. Omit for dev mode, where every request is the user `dev-user`.
   */
  tokens?: Record<string, string>;
  /** Scripts each chat turn. Default: a text reply `Echo: <last user text>`. */
  respond?: (turn: MockMastraChatTurn) => MockMastraReply | Promise<MockMastraReply>;
  /**
   * Title Mastra generates after the first turn of an untitled thread. `false` never titles
   * (use `setTitle`). Default: the first user text.
   */
  title?: false | ((firstUserText: string) => string);
  /** Delay before the generated title is stored, in ms. Default 0. */
  titleDelayMs?: number;
  /** Largest accepted chat body in bytes. Default 10 MiB. */
  maxBodyBytes?: number;
}

/** An in-memory fake of the Mastra server. */
export interface MockMastraServer {
  /** The base URL it answers. */
  readonly baseUrl: string;
  /** A `fetch` that answers requests to `baseUrl` (anything else goes to the real fetch). */
  readonly fetch: typeof fetch;
  /** Replaces `globalThis.fetch` with {@link fetch}; returns the restore function. */
  install(): () => void;
  /** Every request received, oldest first. */
  readonly requests: MockMastraRequest[];
  /** The stored threads. */
  threads(): MockMastraThread[];
  /** A thread's stored messages (assistant runs merged), oldest first. */
  messages(threadId: string): UIMessage[];
  /** Creates (or replaces) a thread with stored messages. */
  seedThread(
    thread: Partial<MockMastraThread> & { id: string },
    messages?: UIMessage[],
  ): MockMastraThread;
  /** Sets a thread's title, as Mastra's asynchronous title generation does. */
  setTitle(threadId: string, title: string): void;
  /**
   * Makes the next request matching `match` fail: with the given status and JSON body, or with a
   * network error (`'network'`, a rejected fetch). Each call arms one failure.
   */
  failNext(
    match: { method?: string; path: string | RegExp },
    failure: { status: number; body?: unknown } | 'network',
  ): void;
  /**
   * Delays the answer to the next request matching `match` by `ms` (for a slow link, e.g. a
   * history load still in flight while the user sends). Each call arms one delay.
   */
  delayNext(match: { method?: string; path: string | RegExp }, ms: number): void;
}

const DEFAULT_TOOLS = ['getWeather', 'bookMeeting', 'askUser'];
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_FRONTEND_TOOLS = 64;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const PART_TYPES = new Set([
  'text',
  'reasoning',
  'step-start',
  'source-url',
  'source-document',
  'file',
  'reasoning-file',
  'dynamic-tool',
  'custom',
  'steering-message',
]);

/**
 * The server's part checks: known UI part types only, and `file`/`reasoning-file` parts carry an
 * inline `data:` URL (never a remote URL the server would download) and no provider reference.
 */
const unsafePart = (parts: unknown[]): string | undefined => {
  for (const part of parts) {
    const type = isRecord(part) ? part['type'] : undefined;
    if (
      typeof type !== 'string' ||
      !(PART_TYPES.has(type) || /^tool-./.test(type) || /^data-./.test(type))
    ) {
      return 'Unsupported message part type';
    }
    const record = part as Record<string, unknown>;
    if (type === 'file' || type === 'reasoning-file') {
      if (record['providerReference'] !== undefined) {
        return 'File provider references are not accepted';
      }
      if (typeof record['url'] !== 'string' || !/^data:/i.test(record['url'])) {
        return 'File parts must be inline data: URLs';
      }
    } else if (type === 'steering-message') {
      const nested = Array.isArray(record['parts'])
        ? unsafePart(record['parts'])
        : 'Steering messages need parts';
      if (nested) return nested;
    }
  }
  return undefined;
};

const textOf = (message: UIMessage | undefined) =>
  (message?.parts ?? [])
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
    .trim();

/** Consecutive assistant messages form one unit keyed by the first id. */
const groupKeys = (messages: UIMessage[]) => {
  const keys: { id: string; size: number }[] = [];
  messages.forEach((message, index) => {
    const prev = messages[index - 1];
    const last = keys.at(-1);
    if (message.role === 'assistant' && prev?.role === 'assistant' && last) last.size++;
    else keys.push({ id: message.id, size: 1 });
  });
  return keys;
};

/**
 * Creates an in-memory fake of the angular-assistant-ui Mastra server (mastra-server) that
 * implements its HTTP contract through `fetch` interception:
 *
 * - `POST /chat/:agentId`: the whitelisted body (`messages` with `user`/`assistant` roles only,
 *   `memory.thread` required, `resumeData` requires `runId`, known UI part types only, file parts
 *   only as inline `data:` URLs), branch reconciliation from
 *   `messageIds` (skipped on resubmits and when `messageIds` is absent), an SSE stream of AI SDK v7 chunks whose `start` carries
 *   the stored assistant id (a resubmit reuses it), and the errors 400/401/403/404/413, plus 409
 *   when an echoed assistant id belongs to another thread.
 * - `GET /chat/:agentId/threads/:threadId/messages`: `{ messages, total }` (consecutive assistant
 *   messages merged under the first id), 404 for an unknown thread.
 * - `GET|POST /api/memory/threads`, `GET|PATCH|DELETE /api/memory/threads/:id`: the stock Mastra
 *   memory routes (zero-based pages, `metadata` replaced as a whole on PATCH, `agentId` query
 *   required on POST/PATCH/DELETE, a non-empty `resourceId` required but ignored on POST).
 * - Every other route (`/api/agents/*`, `/api/memory/threads/:id/messages`, ...) answers
 *   `403 { error: 'Access denied' }` (default deny).
 *
 * Identity always comes from the auth header (or `dev-user`); `resourceId` in bodies and queries
 * is ignored, and another user's thread answers 403. A thread is created on its first chat turn
 * if it does not exist, and titled asynchronously afterwards. `failNext` injects one 5xx (or any
 * status) or network failure into a matching request, for error-path tests.
 */
export function createMockMastraServer(options: MockMastraServerOptions = {}): MockMastraServer {
  const baseUrl = (options.baseUrl ?? 'http://mastra.test').replace(/\/+$/, '');
  const agents = new Set(options.agents ?? ['chatAgent']);
  const serverTools = new Set(options.serverTools ?? DEFAULT_TOOLS);
  const maxBodyBytes = options.maxBodyBytes ?? 10 * 1024 * 1024;
  const threads = new Map<string, MockMastraThread>();
  const stored = new Map<string, UIMessage[]>();
  const requests: MockMastraRequest[] = [];
  let clock = Date.parse('2026-01-01T00:00:00.000Z');
  let ids = 0;
  const now = () => new Date((clock += 1000)).toISOString();
  const newId = (prefix: string) => `${prefix}-${++ids}`;

  const respond =
    options.respond ??
    ((turn: MockMastraChatTurn): MockMastraReply => {
      const lastUser = [...turn.body.messages].reverse().find((m) => m.role === 'user');
      return {
        chunks: [
          { type: 'start-step' },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: `Echo: ${textOf(lastUser)}` },
          { type: 'text-end', id: 't1' },
          { type: 'finish-step' },
          { type: 'finish', finishReason: 'stop' },
        ],
      };
    });

  const threadJson = (thread: MockMastraThread) => ({ ...thread });

  const createThread = (id: string, resourceId: string, metadata?: Record<string, unknown>) => {
    const at = now();
    const thread: MockMastraThread = {
      id,
      resourceId,
      title: '',
      ...(metadata !== undefined && { metadata }),
      createdAt: at,
      updatedAt: at,
    };
    threads.set(id, thread);
    if (!stored.has(id)) stored.set(id, []);
    return thread;
  };

  const userFor = (headers: Record<string, string>): string | undefined => {
    if (!options.tokens) return 'dev-user';
    const match = /^Bearer (.+)$/i.exec(headers['authorization'] ?? '');
    return match ? options.tokens[match[1]!] : undefined;
  };

  const scheduleTitle = (threadId: string) => {
    const thread = threads.get(threadId);
    if (!thread || thread.title || options.title === false) return;
    const firstUser = stored.get(threadId)?.find((m) => m.role === 'user');
    const title = (options.title ?? ((text: string) => text.slice(0, 40) || 'New chat'))(
      textOf(firstUser),
    );
    setTimeout(() => {
      const current = threads.get(threadId);
      if (current && !current.title) {
        current.title = title;
        current.updatedAt = now();
      }
    }, options.titleDelayMs ?? 0);
  };

  const sse = (
    chunks: UIMessageChunk[],
    delayMs: number | undefined,
    signal: AbortSignal | undefined,
    onDone: (completed: boolean) => void,
  ) => {
    const encoder = new TextEncoder();
    let cancelled = false;
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const chunk of chunks) {
          if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (cancelled || signal?.aborted) {
            onDone(false);
            try {
              controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            } catch {
              // already cancelled
            }
            return;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        onDone(true);
      },
      cancel() {
        cancelled = true;
      },
    });
  };

  const handleChat = async (
    agentId: string,
    rawBody: string,
    userId: string,
    signal: AbortSignal | undefined,
  ): Promise<Response> => {
    if (new TextEncoder().encode(rawBody).length > maxBodyBytes) {
      return json(413, { error: 'Request body too large' });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json(400, { error: 'Body must be JSON' });
    }
    const issues: string[] = [];
    if (!isRecord(body)) issues.push('Invalid input: expected object');
    const record = isRecord(body) ? body : {};
    const messages = record['messages'];
    if (!Array.isArray(messages)) issues.push('Invalid input: expected array, received undefined');
    else {
      for (const message of messages) {
        if (!isRecord(message) || typeof message['id'] !== 'string' || !message['id'])
          issues.push('Invalid input: message id');
        else if (message['role'] !== 'user' && message['role'] !== 'assistant')
          issues.push('Invalid option: expected one of "user"|"assistant"');
        else if (!Array.isArray(message['parts'])) issues.push('Invalid input: message parts');
        else {
          const problem = unsafePart(message['parts']);
          if (problem) issues.push(problem);
        }
      }
    }
    const memory = record['memory'];
    if (!isRecord(memory) || typeof memory['thread'] !== 'string' || !memory['thread'])
      issues.push('Invalid input: expected object, received undefined');
    if (issues.length > 0) return json(400, { error: 'Invalid request body', issues });
    if (record['resumeData'] !== undefined && typeof record['runId'] !== 'string') {
      return json(400, { error: 'runId is required with resumeData' });
    }
    if (!agents.has(agentId)) return json(404, { error: `Agent ${agentId} not found` });

    // Only whitelisted fields survive.
    const turnBody: MockMastraChatTurn['body'] = {
      messages: messages as UIMessage[],
      memory: { thread: (memory as { thread: string }).thread },
      ...(Array.isArray(record['messageIds']) && {
        messageIds: record['messageIds'] as string[],
      }),
      ...(typeof record['trigger'] === 'string' && { trigger: record['trigger'] }),
      ...(typeof record['messageId'] === 'string' && { messageId: record['messageId'] }),
      ...(isRecord(record['resumeData']) && { resumeData: record['resumeData'] }),
      ...(typeof record['runId'] === 'string' && { runId: record['runId'] }),
      ...(isRecord(record['tools']) && {
        tools: record['tools'] as NonNullable<MockMastraChatTurn['body']['tools']>,
      }),
    };
    const threadId = turnBody.memory.thread;
    const existing = threads.get(threadId);
    if (existing && existing.resourceId !== userId) {
      return json(403, { error: 'Access denied: thread belongs to a different user' });
    }
    // An assistant id the client echoes must belong to this thread (and user).
    const assistantIds = turnBody.messages.filter((m) => m.role === 'assistant').map((m) => m.id);
    for (const [otherId, otherLog] of stored) {
      if (otherId === threadId && existing) continue;
      if (otherLog.some((m) => m.role === 'assistant' && assistantIds.includes(m.id))) {
        return json(409, { error: 'Message id already in use' });
      }
    }
    const thread = existing ?? createThread(threadId, userId, {});
    const log = stored.get(threadId)!;
    const last = turnBody.messages.at(-1);
    const isResubmit = turnBody.resumeData !== undefined || last?.role === 'assistant';

    // Reconcile: keep the longest stored prefix (by unit) matching messageIds.
    if (turnBody.messageIds && existing && !isResubmit) {
      const units = groupKeys(log);
      let keep = 0;
      while (
        keep < units.length &&
        keep < turnBody.messageIds.length &&
        units[keep]!.id === turnBody.messageIds[keep]
      )
        keep++;
      const keepCount = units.slice(0, keep).reduce((sum, unit) => sum + unit.size, 0);
      log.splice(keepCount);
    }
    // Upsert the sent messages (de-duplicated by id).
    for (const message of turnBody.messages) {
      const index = log.findIndex((m) => m.id === message.id);
      if (index >= 0) log[index] = structuredClone(message);
      else log.push(structuredClone(message));
    }

    const clientTools = Object.keys(turnBody.tools ?? {})
      .slice(0, MAX_FRONTEND_TOOLS)
      .filter((name) => TOOL_NAME.test(name) && !serverTools.has(name));
    const reply = await respond({
      agentId,
      threadId,
      userId,
      body: turnBody,
      isResubmit,
      stored: structuredClone(log),
      clientTools,
    });
    const assistantId = isResubmit && last?.role === 'assistant' ? last.id : newId('msg');
    const chunks: UIMessageChunk[] = [{ type: 'start', messageId: assistantId }, ...reply.chunks];

    const finalize = async (completed: boolean) => {
      if (!completed) return;
      const base = isResubmit && last?.role === 'assistant' ? structuredClone(last) : undefined;
      let message: UIMessage | undefined;
      const stream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
      for await (const snapshot of readUIMessageStream({
        ...(base && { message: base }),
        stream,
      })) {
        message = snapshot;
      }
      if (message) {
        const index = log.findIndex((m) => m.id === message!.id);
        if (index >= 0) log[index] = structuredClone(message);
        else log.push(structuredClone(message));
      }
      thread.updatedAt = now();
      scheduleTitle(threadId);
    };

    return new Response(
      sse(chunks, reply.delayMs, signal, (done) => void finalize(done)),
      {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
      },
    );
  };

  const handleHistory = (agentId: string, threadId: string, userId: string) => {
    if (!agents.has(agentId)) return json(404, { error: `Agent ${agentId} not found` });
    const thread = threads.get(threadId);
    if (!thread) return json(404, { error: 'Thread not found' });
    if (thread.resourceId !== userId) {
      return json(403, { error: 'Access denied: thread belongs to a different user' });
    }
    const log = stored.get(threadId) ?? [];
    // Merge consecutive assistant messages under the first id.
    const merged: UIMessage[] = [];
    for (const message of log) {
      const prev = merged.at(-1);
      if (message.role === 'assistant' && prev?.role === 'assistant') {
        prev.parts.push(...structuredClone(message.parts));
      } else {
        merged.push({
          ...structuredClone(message),
          metadata: {
            ...(isRecord(message.metadata) ? message.metadata : {}),
            createdAt: thread.createdAt,
            threadId,
            resourceId: userId,
          },
        });
      }
    }
    return json(200, { messages: merged, total: merged.length });
  };

  const missingAgent = () =>
    json(400, {
      error: 'Invalid query parameters',
      issues: [{ field: 'agentId', message: 'Invalid input: expected string, received undefined' }],
    });
  const notFound = () => json(404, { error: 'Thread not found' });
  const accessDenied = () => json(403, { error: 'Access denied' });
  const forbidden = () =>
    json(403, { error: 'Access denied: thread belongs to a different resource' });

  const handleMemory = (
    method: string,
    threadId: string | undefined,
    query: URLSearchParams,
    body: unknown,
    userId: string,
  ): Response => {
    if (threadId === undefined) {
      if (method === 'GET') {
        const page = Number(query.get('page') ?? 0);
        const perPage = Number(query.get('perPage') ?? 100);
        const field = query.get('orderBy[field]') === 'updatedAt' ? 'updatedAt' : 'createdAt';
        const direction = query.get('orderBy[direction]') === 'ASC' ? 1 : -1;
        const mine = [...threads.values()]
          .filter((t) => t.resourceId === userId)
          .sort((a, b) => direction * a[field].localeCompare(b[field]));
        const slice = mine.slice(page * perPage, (page + 1) * perPage);
        return json(200, {
          threads: slice.map(threadJson),
          total: mine.length,
          page,
          perPage,
          hasMore: (page + 1) * perPage < mine.length,
        });
      }
      if (method === 'POST') {
        if (!query.get('agentId')) return missingAgent();
        if (!isRecord(body) || typeof body['resourceId'] !== 'string' || !body['resourceId']) {
          return json(400, {
            error: 'Invalid request body',
            issues: [
              {
                field: 'resourceId',
                message: 'Invalid input: expected a non-empty string',
              },
            ],
          });
        }
        const id = typeof body['threadId'] === 'string' ? body['threadId'] : newId('thread');
        const other = threads.get(id);
        if (other && other.resourceId !== userId) return forbidden();
        const thread = createThread(
          id,
          userId,
          isRecord(body['metadata']) ? body['metadata'] : undefined,
        );
        if (typeof body['title'] === 'string') thread.title = body['title'];
        return json(200, threadJson(thread));
      }
      return accessDenied();
    }
    if (method !== 'GET' && method !== 'PATCH' && method !== 'DELETE') return accessDenied();
    const thread = threads.get(threadId);
    if (method !== 'GET' && !query.get('agentId')) return missingAgent();
    if (!thread) return notFound();
    if (thread.resourceId !== userId) return forbidden();
    if (method === 'GET') return json(200, threadJson(thread));
    if (method === 'PATCH') {
      if (isRecord(body)) {
        if (typeof body['title'] === 'string') thread.title = body['title'];
        if (isRecord(body['metadata'])) thread.metadata = body['metadata'];
      }
      thread.updatedAt = now();
      return json(200, threadJson(thread));
    }
    if (method === 'DELETE') {
      threads.delete(threadId);
      stored.delete(threadId);
      return json(200, { result: 'Thread deleted' });
    }
    return accessDenied();
  };

  const realFetch = globalThis.fetch;
  const failures: {
    match: { method?: string; path: string | RegExp };
    failure: { status: number; body?: unknown } | 'network';
  }[] = [];
  const delays: { match: { method?: string; path: string | RegExp }; ms: number }[] = [];

  const mockFetch: typeof fetch = async (input, init) => {
    const isRequest = typeof Request !== 'undefined' && input instanceof Request;
    const href = isRequest ? input.url : String(input);
    if (!href.startsWith(`${baseUrl}/`)) return realFetch(input, init);
    const url = new URL(href);
    const path = url.pathname.slice(new URL(baseUrl).pathname.replace(/\/$/, '').length);
    const headers: Record<string, string> = {};
    new Headers(init?.headers ?? (isRequest ? input.headers : undefined)).forEach((value, key) => {
      headers[key] = value;
    });
    const method = (init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
    const rawBody =
      init?.body !== undefined && init.body !== null
        ? typeof init.body === 'string'
          ? init.body
          : await new Response(init.body).text()
        : isRequest && method !== 'GET'
          ? await input.text()
          : '';
    let parsed: unknown;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
      parsed = rawBody;
    }
    requests.push({ method, path, query: url.searchParams, headers, body: parsed });

    const matches = (match: { method?: string; path: string | RegExp }) =>
      (match.method === undefined || match.method.toUpperCase() === method) &&
      (typeof match.path === 'string' ? match.path === path : match.path.test(path));
    const delayed = delays.findIndex(({ match }) => matches(match));
    if (delayed >= 0) {
      const [{ ms }] = delays.splice(delayed, 1) as [(typeof delays)[number]];
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    const armed = failures.findIndex(({ match }) => matches(match));
    if (armed >= 0) {
      const [{ failure }] = failures.splice(armed, 1) as [(typeof failures)[number]];
      if (failure === 'network') throw new TypeError('Failed to fetch');
      return json(failure.status, failure.body ?? { error: 'Internal Server Error' });
    }

    const userId = userFor(headers);
    if (!userId) return json(401, { error: 'Invalid or expired token' });

    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'chat' && parts[1]) {
      if (parts.length === 2 && method === 'POST') {
        const signal = init?.signal ?? (isRequest ? input.signal : undefined);
        return handleChat(parts[1], rawBody, userId, signal ?? undefined);
      }
      if (parts.length === 5 && parts[2] === 'threads' && parts[4] === 'messages') {
        if (method === 'GET') return handleHistory(parts[1], parts[3]!, userId);
      }
    }
    if (parts[0] === 'api' && parts[1] === 'memory' && parts[2] === 'threads') {
      if (parts.length <= 4)
        return handleMemory(method, parts[3], url.searchParams, parsed, userId);
    }
    // Default deny: every other route (`/api/agents/*`, stock message routes, ...).
    return accessDenied();
  };

  return {
    baseUrl,
    fetch: mockFetch,
    install() {
      const previous = globalThis.fetch;
      globalThis.fetch = mockFetch;
      return () => {
        globalThis.fetch = previous;
      };
    },
    requests,
    threads: () => [...threads.values()].map((thread) => structuredClone(thread)),
    messages: (threadId) => structuredClone(stored.get(threadId) ?? []),
    seedThread(seed, messages = []) {
      const thread = createThread(seed.id, seed.resourceId ?? 'dev-user', seed.metadata);
      Object.assign(thread, seed);
      stored.set(seed.id, structuredClone(messages));
      return structuredClone(thread);
    },
    failNext(match, failure) {
      failures.push({ match, failure });
    },
    delayNext(match, ms) {
      delays.push({ match, ms });
    },
    setTitle(threadId, title) {
      const thread = threads.get(threadId);
      if (!thread) throw new Error(`MockMastraServer: no thread ${threadId}`);
      thread.title = title;
      thread.updatedAt = now();
    },
  };
}
