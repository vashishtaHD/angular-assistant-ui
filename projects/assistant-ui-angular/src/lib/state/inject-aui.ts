// Ported from packages/vue/src/useAui.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { assertInInjectionContext } from '@angular/core';
import type { AssistantClient } from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

/**
 * Returns the `AssistantClient` provided by the nearest
 * {@link AuiProviderDirective}. Must be called in an injection context.
 *
 * The returned object is stable for the lifetime of the provider and always
 * forwards to the provider's current client, so it can be captured once and
 * used in event handlers: `aui.composer.send()`, `aui.thread.cancelRun()`.
 * Pair with {@link injectAuiState} to read reactive state and
 * {@link injectAuiEvent} to subscribe to events.
 *
 * Called outside a provider, the returned client's scope accessors throw a
 * descriptive error whenever they are used.
 */
export function injectAui(): AssistantClient {
  assertInInjectionContext(injectAui);
  return injectAuiContext().aui;
}
