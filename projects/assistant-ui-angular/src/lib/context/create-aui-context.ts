// Ported from packages/vue/src/AuiProvider.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  createAssistantClient,
  createClientFacade,
  type AssistantClient,
  type AssistantClientHandle,
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
   * plain client. Omit to create a root client. A forwarding source registered
   * with {@link registerForwardingSource} is replaced by its real handle.
   */
  parent?: AssistantClient | AssistantClientSource;
}

/** Result of {@link createAuiContext}. */
export interface CreatedAuiContext {
  /** Context whose `source` is the real `handle`. */
  context: AuiContext;
  /** The store handle; pass it (or `context.source`) as a child's `parent`. */
  handle: AssistantClientHandle;
  /** Releases the lifetime subscription. */
  release: () => void;
}

const forwardingSources = new WeakMap<
  AssistantClientSource,
  () => AssistantClientSource | undefined
>();

/**
 * Registers `source` as a forwarding wrapper whose real handle is returned by
 * `resolve` (once it exists). The store only takes its parent-snapshot fast
 * path for real handles, so {@link createAuiContext} unwraps registered
 * wrappers before passing them as `parent`.
 */
export function registerForwardingSource(
  source: AssistantClientSource,
  resolve: () => AssistantClientSource | undefined,
): void {
  forwardingSources.set(source, resolve);
}

/** Returns the real source behind a registered forwarding wrapper, if any. */
export function resolveParentSource<T extends AssistantClient | AssistantClientSource>(
  parent: T,
): T | AssistantClientSource {
  return forwardingSources.get(parent as AssistantClientSource)?.() ?? parent;
}

/**
 * Creates an `AssistantClient` over a live config and holds the lifetime
 * subscription that keeps it mounted until `release` is called.
 */
export function createAuiContext(options: CreateAuiContextOptions): CreatedAuiContext {
  const { getConfig, subscribe } = options;
  const parent = options.parent ? resolveParentSource(options.parent) : undefined;
  const handle = createAssistantClient({ getConfig, subscribe }, parent ? { parent } : undefined);
  // The provider holds the lifetime subscription that keeps the client
  // mounted while descendants come and go.
  const release = handle.subscribe(() => undefined);
  return {
    context: { source: handle, aui: createClientFacade(handle) },
    handle,
    release,
  };
}
