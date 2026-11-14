// Ported from packages/vue/src/context.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { InjectionToken, inject } from '@angular/core';
import {
  DefaultAssistantClient,
  type AssistantClient,
  type AssistantClientSource,
} from '@assistant-ui/store/client';

/**
 * What an {@link AuiProviderDirective} provides to its subtree: the live
 * client `source` (re-read on every notification) and a stable `aui` facade
 * that forwards to the source's current client.
 */
export interface AuiContext {
  source: AssistantClientSource;
  aui: AssistantClient;
}

/** Injection token for the nearest provider's {@link AuiContext}. */
export const AUI_CONTEXT = new InjectionToken<AuiContext>('assistant-ui.angular.aui');

const NO_OP_SUBSCRIBE = () => () => undefined;

const defaultContext: AuiContext = {
  source: {
    getClient: () => DefaultAssistantClient,
    subscribe: NO_OP_SUBSCRIBE,
  },
  aui: DefaultAssistantClient,
};

/**
 * Returns the nearest provider's context, or a default context whose client
 * throws "wrap in a provider" errors when its scopes are used.
 * Must be called in an injection context.
 */
export function injectAuiContext(): AuiContext {
  return inject(AUI_CONTEXT, { optional: true }) ?? defaultContext;
}
