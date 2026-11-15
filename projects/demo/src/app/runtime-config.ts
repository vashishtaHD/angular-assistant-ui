// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import {
  APP_INITIALIZER,
  Injectable,
  InjectionToken,
  inject,
  isDevMode,
  type Provider,
} from '@angular/core';
import type { MastraAuth } from 'angular-assistant-ui/mastra';

/** Settings read at startup from `/config.json`, so one build fits any environment. */
export interface RuntimeConfig {
  /** The Mastra server origin (and optional path prefix). */
  mastraUrl: string;
  /** The Mastra agent to chat with; its chat route is `<mastraUrl>/chat/<agentId>`. */
  agentId: string;
  /**
   * A bearer token for the server's token (jwt) auth mode. Leave it empty for dev mode
   * (`MASTRA_AUTH_MODE=dev`), where the server needs no token and none is sent. `/config.json`
   * is public, so this suits a shared test token only; a real app gets a per-user token from its
   * sign-in and provides `MASTRA_AUTH` itself.
   */
  authToken?: string;
}

/** Used when `/config.json` is missing or does not set a value. */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  mastraUrl: 'http://localhost:4111',
  agentId: 'chatAgent',
};

/** A `/config.json` the app cannot start with; `problems` lists every fault. */
export class RuntimeConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid runtime config (/config.json): ${problems.join('; ')}`);
    this.name = 'RuntimeConfigError';
  }
}

/** Whether a missing key or file is an error (production) or falls back to a default. */
export interface RuntimeConfigMode {
  production: boolean;
}

const AGENT_ID = /^[A-Za-z0-9_-]+$/;

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates a parsed `/config.json`. `mastraUrl` must be an absolute http(s) URL (a trailing
 * slash is dropped), `agentId` a path-safe name and `authToken` a string. In development a missing
 * key takes its default; in production `mastraUrl` and `agentId` are required, so a deployment
 * never silently talks to `localhost`. Throws a {@link RuntimeConfigError} naming every problem.
 */
export function parseRuntimeConfig(raw: unknown, mode: RuntimeConfigMode): RuntimeConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new RuntimeConfigError(['config.json must hold a JSON object']);
  }
  const record = raw as Record<string, unknown>;
  const problems: string[] = [];
  /** The key's value, its default in development, or `undefined` (reported) in production. */
  const required = (key: 'mastraUrl' | 'agentId'): unknown => {
    if (record[key] !== undefined) return record[key];
    if (!mode.production) return DEFAULT_RUNTIME_CONFIG[key];
    problems.push(`${key} is required in a production build`);
    return undefined;
  };

  const rawUrl = required('mastraUrl');
  const mastraUrl = typeof rawUrl === 'string' ? rawUrl.trim().replace(/\/+$/, '') : '';
  if (rawUrl !== undefined && !isHttpUrl(mastraUrl)) {
    problems.push('mastraUrl must be an absolute http(s) URL');
  }

  const agentId = required('agentId');
  if (agentId !== undefined && (typeof agentId !== 'string' || !AGENT_ID.test(agentId))) {
    problems.push('agentId must be a non-empty string of letters, digits, "-" or "_"');
  }

  const authToken = record['authToken'];
  if (authToken !== undefined && typeof authToken !== 'string') {
    problems.push('authToken must be a string');
  }

  if (problems.length > 0) throw new RuntimeConfigError(problems);
  return {
    mastraUrl,
    agentId: agentId as string,
    ...(typeof authToken === 'string' && { authToken }),
  };
}

/** Holds the runtime config loaded by the app initializer. */
@Injectable({ providedIn: 'root' })
export class RuntimeConfigStore {
  /** The loaded config (the defaults until the initializer has run). */
  config: RuntimeConfig = DEFAULT_RUNTIME_CONFIG;

  /**
   * Fetches and validates `url` ({@link parseRuntimeConfig}). An invalid file always rejects. A
   * missing or unreadable file rejects in production; in development it logs a warning and keeps
   * the localhost defaults. A rejection stops the app's bootstrap (see {@link renderStartupError}).
   */
  async load(
    url = '/config.json',
    mode: RuntimeConfigMode = { production: !isDevMode() },
  ): Promise<void> {
    let raw: unknown;
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      raw = await response.json();
    } catch (error) {
      if (mode.production) {
        throw new RuntimeConfigError([`could not load ${url} (${String(error)})`]);
      }
      console.warn(`Could not load ${url}; using the default runtime config.`, error);
      return;
    }
    this.config = parseRuntimeConfig(raw, mode);
  }
}

/**
 * Replaces the page with a readable startup failure (text only), for a bootstrap that rejected,
 * typically with a {@link RuntimeConfigError}. The error is also logged.
 */
export function renderStartupError(error: unknown, doc: Document = document): void {
  console.error(error);
  const box = doc.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = 'font: 14px/1.5 system-ui, sans-serif; margin: 2rem; max-width: 40rem;';
  const title = doc.createElement('h1');
  title.style.fontSize = '1.25rem';
  title.textContent = 'The app could not start';
  const list = doc.createElement('ul');
  const problems =
    error instanceof RuntimeConfigError
      ? error.problems
      : [String((error as Error)?.message ?? error)];
  for (const problem of problems) {
    const item = doc.createElement('li');
    item.textContent = problem;
    list.append(item);
  }
  const hint = doc.createElement('p');
  hint.textContent =
    'Check the /config.json served with this deployment (see docs/deployment.md, "Per-environment /config.json").';
  box.append(title, list, hint);
  doc.body.replaceChildren(box);
}

/** The runtime config (tests provide it directly). */
export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG', {
  providedIn: 'root',
  factory: () => inject(RuntimeConfigStore).config,
});

/** Loads `/config.json` before the app starts (`APP_INITIALIZER` works on Angular 18–22). */
export function provideRuntimeConfig(): Provider {
  return {
    provide: APP_INITIALIZER,
    multi: true,
    useFactory: () => {
      const store = inject(RuntimeConfigStore);
      return () => store.load();
    },
  };
}

/**
 * Builds the Mastra auth from the runtime config: a bearer token when `authToken` is set,
 * otherwise no header (the server's dev mode).
 */
export function mastraAuthFromConfig(config: RuntimeConfig): MastraAuth {
  const token = config.authToken?.trim();
  return {
    getHeaders: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
