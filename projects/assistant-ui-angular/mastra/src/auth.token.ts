import { InjectionToken, inject } from '@angular/core';

/**
 * How requests to the Mastra server are authenticated. The host app provides it (usually through
 * {@link MASTRA_AUTH}); the server derives the user (Mastra resource id) from these headers, so
 * the client never sends a resource id.
 *
 * In the server's dev mode no header is needed, so `getHeaders()` may return `{}`. In token mode
 * return `{ Authorization: 'Bearer <token>' }`.
 */
export interface MastraAuth {
  /** Headers added to every chat, history and thread-list request. Called per request. */
  getHeaders(): Record<string, string> | Promise<Record<string, string>>;
  /** `fetch` credentials mode (for cookie-based auth across origins). */
  credentials?: RequestCredentials;
}

/**
 * Injection token for the app's {@link MastraAuth}. `createMastraTransport` and
 * `mastraThreadListAdapter` read it when they are called in an injection context without an
 * explicit `auth` option.
 *
 * @example
 * ```ts
 * providers: [{ provide: MASTRA_AUTH, useValue: { getHeaders: () => ({ Authorization: `Bearer ${token()}` }) } }]
 * ```
 */
export const MASTRA_AUTH = new InjectionToken<MastraAuth>('MASTRA_AUTH');

/**
 * Returns `explicit`, else the provided {@link MASTRA_AUTH} when called in an injection context,
 * else `undefined` (no auth headers).
 *
 * Only a missing injection context or provider yields `undefined`; an error thrown while the
 * provider is created propagates, so a broken auth setup fails loudly instead of sending
 * unauthenticated requests.
 *
 * @param explicit The `auth` option passed by the caller, if any.
 */
export function resolveMastraAuth(explicit: MastraAuth | undefined): MastraAuth | undefined {
  if (explicit) return explicit;
  try {
    return inject(MASTRA_AUTH, { optional: true }) ?? undefined;
  } catch (error) {
    if (isMissingInjectionContext(error)) return undefined;
    throw error;
  }
}

/**
 * Whether `error` is Angular's NG0203 ("inject() must be called from an injection context").
 * `isInjectionContext()` is not exported by every supported Angular version, so the error code
 * is checked instead.
 */
export const isMissingInjectionContext = (error: unknown): boolean =>
  error instanceof Error && /NG0?203\b/.test(error.message);
