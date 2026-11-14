import { APP_INITIALIZER, Injectable, InjectionToken, inject, type Provider } from '@angular/core';

/** Settings read at startup from `/config.json`, so one build fits any environment. */
export interface RuntimeConfig {
  /** The Mastra chat route the transport posts to. */
  mastraChatUrl: string;
}

/** Used when `/config.json` is missing or does not set a value. */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  mastraChatUrl: 'http://localhost:4111/chat/chatAgent',
};

/** The Mastra chat endpoint URL, from the runtime config. */
export const MASTRA_CHAT_URL = new InjectionToken<string>('MASTRA_CHAT_URL', {
  providedIn: 'root',
  factory: () => inject(RuntimeConfigStore).config.mastraChatUrl,
});

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
