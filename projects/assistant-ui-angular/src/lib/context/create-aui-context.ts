// Ported from packages/vue/src/AuiProvider.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  createAssistantClient,
  createClientFacade,
  type AssistantClient,
  type AssistantClientSource,
  type AuiConfig,
  type Unsubscribe,
} from '@assistant-ui/store/client';
import type { AuiContext } from './aui-context';

/** Options for {@link createAuiContext}. */
export interface CreateAuiContextOptions {
  /** Returns the current config; re-read whenever `subscribe` notifies. */
  getConfig: () => AuiConfig;
  /** Subscribes to config changes. */
  subscribe: (listener: () => void) => Unsubscribe;
  /**
   * Parent to extend: a source (followed across its structural changes) or a
   * plain client. Omit to create a root client.
   */
  parent?: AssistantClient | AssistantClientSource;
}

/**
 * Creates an `AssistantClient` over a live config and holds the lifetime
 * subscription that keeps it mounted until `release` is called.
 */
export function createAuiContext(options: CreateAuiContextOptions): {
  context: AuiContext;
  release: () => void;
} {
  const { getConfig, subscribe, parent } = options;
  const handle = createAssistantClient({ getConfig, subscribe }, parent ? { parent } : undefined);
  // The provider holds the lifetime subscription that keeps the client
  // mounted while descendants come and go.
  const release = handle.subscribe(() => undefined);
  return {
    context: { source: handle, aui: createClientFacade(handle) },
    release,
  };
}
