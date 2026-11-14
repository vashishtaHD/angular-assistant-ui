import { createHmac } from 'node:crypto';
import { createHonoServer } from '@mastra/deployer/server';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { createMastra, type CreateMastraOptions } from '../mastra';
import { scriptedModel } from './mock-model';

export const JWT_SECRET = 'test-secret-not-for-production';

/** Signs an HS256 JWT for tests. */
export function signJwt(claims: Record<string, unknown>, secret = JWT_SECRET): string {
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(claims)}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

/** Bearer header for user `sub`. */
export function bearer(sub: string): Record<string, string> {
  return { authorization: `Bearer ${signJwt({ sub })}` };
}

/** Parses an AI SDK UI message stream (SSE) body into its JSON chunks. */
export function parseChunks(text: string): Array<Record<string, any>> {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
    .map((line) => JSON.parse(line.slice(6)));
}

export interface TestServerOptions extends Omit<CreateMastraOptions, 'model'> {
  steps?: LanguageModelV3StreamPart[][];
  env?: Record<string, string>;
}

/** An in-process Mastra server with in-memory storage and a scripted mock model. */
export async function createTestServer(options: TestServerOptions = {}) {
  const sm = scriptedModel(options.steps);
  const env = {
    MASTRA_AUTH_MODE: 'jwt',
    MASTRA_JWT_SECRET: JWT_SECRET,
    MASTRA_DB_URL: ':memory:',
    FRONTEND_ORIGIN: 'http://localhost:4200',
    ...options.env,
  } as NodeJS.ProcessEnv;
  const mastra = createMastra({ ...options, env, model: sm.model as never });
  const app = await createHonoServer(mastra, { tools: {} });

  const request = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
    app.request(path, init);

  const post = async (body: unknown, headers: Record<string, string>, agentId = 'chatAgent') => {
    const res = await request(`/chat/${agentId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, chunks: res.status === 200 ? parseChunks(text) : [] };
  };

  const history = async (threadId: string, headers: Record<string, string>) => {
    const res = await request(`/chat/chatAgent/threads/${threadId}/messages`, { headers });
    return { status: res.status, body: (await res.json()) as any };
  };

  return { app, mastra, sm, request, post, history };
}

/** A text user message in AI SDK v7 UI shape. */
export function userMessage(id: string, text: string) {
  return { id, role: 'user' as const, parts: [{ type: 'text' as const, text }] };
}
