// Original (no upstream counterpart): the Mastra server instance, its routes and auth.
import { Mastra } from '@mastra/core';
import type { Context, Next } from 'hono';
import { LibSQLStore } from '@mastra/libsql';
import { createChatAgent, type ChatAgentModel } from './agents/chat-agent';
import { createAuthConfig, type VerifyToken } from './auth';
import { createChatRoutes } from './routes/chat-route';

export interface CreateMastraOptions {
  /** Environment to read configuration from. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Agent model. Tests pass an AI SDK mock language model. */
  model?: ChatAgentModel;
  /** Replaces the default HS256 verifier in `jwt` mode. */
  verifyToken?: VerifyToken;
}

/** Builds the Mastra instance: memory storage, whitelisting chat routes and server-derived identity. */
function createMastraConfig(options: CreateMastraOptions = {}) {
  const env = options.env ?? process.env;
  const authMode = env['MASTRA_AUTH_MODE'];
  return {
    agents: { chatAgent: createChatAgent({ model: options.model }) },
    storage: new LibSQLStore({
      id: 'mastra-storage',
      url: env['MASTRA_DB_URL'] ?? 'file:./mastra.db',
    }),
    server: {
      auth: createAuthConfig({ env, verifyToken: options.verifyToken }),
      cors: {
        origin: env['FRONTEND_ORIGIN'] || 'http://localhost:4200',
        credentials: true,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      middleware:
        authMode === 'dev'
          ? [
              // Dev mode has no login: give token-less requests a placeholder bearer token.
              async (c: Context, next: Next) => {
                if (!c.req.header('authorization')) {
                  const headers = new Headers(c.req.raw.headers);
                  headers.set('authorization', 'Bearer dev');
                  c.req.raw = new Request(c.req.raw, { headers });
                }
                await next();
              },
            ]
          : [],
      apiRoutes: createChatRoutes({
        path: '/chat/:agentId',
        maxBodyBytes: Number(env['MASTRA_MAX_BODY_BYTES']) || undefined,
      }),
    },
  };
}

/** Builds a Mastra instance. Tests use it to inject a mock model and an environment. */
export function createMastra(options: CreateMastraOptions = {}) {
  return new Mastra(createMastraConfig(options));
}

export const mastra = new Mastra(createMastraConfig());
