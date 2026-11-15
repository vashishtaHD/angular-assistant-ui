// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import { APP_INITIALIZER, Injectable, InjectionToken, inject, type Provider } from '@angular/core';
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

/** Holds the runtime config loaded by the app initializer. */
@Injectable({ providedIn: 'root' })
export class RuntimeConfigStore {
  /** The loaded config (the defaults until the initializer has run). */
  config: RuntimeConfig = DEFAULT_RUNTIME_CONFIG;

  /** Fetches `url` and merges it over the defaults. */
  async load(url = '/config.json'): Promise<void> {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const loaded = (await response.json()) as Partial<RuntimeConfig>;
      this.config = { ...DEFAULT_RUNTIME_CONFIG, ...loaded };
    } catch (error) {
      console.warn(`Could not load ${url}; using the default runtime config.`, error);
    }
  }
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
