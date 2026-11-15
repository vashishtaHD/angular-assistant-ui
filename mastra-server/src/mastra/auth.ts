// Original (no upstream counterpart): HS256 bearer-token auth for the Mastra server.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MastraAuthConfig } from '@mastra/core/server';

/** The identity the server derives from a verified request. */
export interface AuthUser {
  id: string;
}

/** Resolves a bearer token to a user, or null when the token is not valid. */
export type VerifyToken = (token: string) => Promise<AuthUser | null> | AuthUser | null;

/** The fixed user of `MASTRA_AUTH_MODE=dev`. */
export const DEV_USER_ID = 'dev-user';

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/**
 * Example verifier: an HS256 JWT signed with a shared secret. It requires `alg: HS256`, a valid
 * signature, a non-empty `sub` (the user id) and honours `exp` and `nbf`.
 * Swap it for your own `verifyToken` (JWKS, session lookup, ...) in production.
 */
export function createHs256Verifier(secret: string): VerifyToken {
  if (!secret) throw new Error('MASTRA_JWT_SECRET must not be empty');
  return (token) => {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    try {
      const head = decodeSegment(header) as { alg?: unknown };
      if (head.alg !== 'HS256') return null;
      const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
      const claims = decodeSegment(payload) as { sub?: unknown; exp?: unknown; nbf?: unknown };
      const now = Date.now() / 1000;
      if (typeof claims.exp === 'number' && claims.exp <= now) return null;
      if (typeof claims.nbf === 'number' && claims.nbf > now) return null;
      if (typeof claims.sub !== 'string' || !claims.sub.trim()) return null;
      return { id: claims.sub };
    } catch {
      return null;
    }
  };
}

export interface AuthOptions {
  /** Environment to read the mode and secrets from. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Replaces the default HS256 verifier in `jwt` mode. */
  verifyToken?: VerifyToken;
}

/** The auth mode selected by `MASTRA_AUTH_MODE`. */
export type AuthMode = 'dev' | 'jwt';

/** Reads and validates `MASTRA_AUTH_MODE`. It throws when the mode is missing or unknown. */
export function resolveAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const mode = env['MASTRA_AUTH_MODE'];
  if (mode === 'dev') {
    if (env['MASTRA_DEV_AUTH'] !== '1') {
      throw new Error(
        'MASTRA_AUTH_MODE=dev requires MASTRA_DEV_AUTH=1 (the dev user has no login).',
      );
    }
    return 'dev';
  }
  if (mode === 'jwt') return 'jwt';
  throw new Error("MASTRA_AUTH_MODE must be 'dev' or 'jwt'.");
}

const ALLOWED_ROUTES: Array<[RegExp, readonly string[]]> = [
  // Custom, whitelisting chat routes.
  [/^\/chat\/[^/]+$/, ['POST']],
  [/^\/chat\/[^/]+\/threads\/[^/]+\/messages$/, ['GET']],
  // Thread list and thread CRUD. Messages are read through the chat history route.
  [/^\/api\/memory\/threads$/, ['GET', 'POST']],
  [/^\/api\/memory\/threads\/[^/]+$/, ['GET', 'PATCH', 'DELETE']],
];

/**
 * Default deny. Mastra mounts stock endpoints (`/api/agents/:id/stream`, `/generate`, tool
 * execution, workflows, raw message writes) that accept arbitrary agent options, so only the
 * routes this app uses are reachable by an authenticated caller.
 */
export function isAllowedRoute(path: string, method: string): boolean {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return ALLOWED_ROUTES.some(
    ([pattern, methods]) => pattern.test(normalized) && methods.includes(method.toUpperCase()),
  );
}

/**
 * Builds `server.auth`. The resource id of every memory call is derived here from the verified
 * user (`mapUserToResourceId`); Mastra ignores a `resourceId` in a body or query once it is set.
 */
export function createAuthConfig(options: AuthOptions = {}): MastraAuthConfig<AuthUser> {
  const env = options.env ?? process.env;
  const mode = resolveAuthMode(env);
  let verify: VerifyToken;
  if (mode === 'dev') {
    verify = () => ({ id: DEV_USER_ID });
  } else if (options.verifyToken) {
    verify = options.verifyToken;
  } else {
    verify = createHs256Verifier(env['MASTRA_JWT_SECRET'] ?? '');
  }
  return {
    authenticateToken: async (token) => (await verify(token)) ?? (null as never),
    mapUserToResourceId: (user) => user.id,
    authorize: async (path, method) => isAllowedRoute(path, method),
  };
}
