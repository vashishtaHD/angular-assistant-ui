// Ported from packages/vue/src/useAuiEvent.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { DestroyRef, assertInInjectionContext, inject, isDevMode } from '@angular/core';
import {
  normalizeEventSelector,
  type AssistantClient,
  type AssistantEventCallback,
  type AssistantEventName,
  type AssistantEventSelector,
  type Unsubscribe,
} from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

/**
 * Subscribes to an assistant event for the lifetime of the current injection
 * context. Must be called in an injection context.
 *
 * The subscription follows the provider's current client across structural
 * changes. Use `scope: "*"` to receive emissions from any descendant scope.
 *
 * @example
 * ```ts
 * injectAuiEvent('thread.modelContextUpdate', ({ threadId }) => {
 *   analytics.track('model_context_update', { threadId });
 * });
 * ```
 */
export function injectAuiEvent<TEvent extends AssistantEventName>(
  selector: AssistantEventSelector<TEvent>,
  callback: AssistantEventCallback<TEvent>,
): void {
  assertInInjectionContext(injectAuiEvent);
  const { source } = injectAuiContext();
  const { scope, event } = normalizeEventSelector(selector);

  let bound: AssistantClient | undefined;
  let off: Unsubscribe | undefined;

  const bind = () => {
    const client = source.getClient();
    if (client === bound) return;
    let next: Unsubscribe;
    try {
      next = client.on({ scope, event } as AssistantEventSelector<TEvent>, callback);
    } catch (error) {
      // A live config may drop the selected scope; keep the current binding and
      // retry once a later structural change makes the scope available again. A
      // selector that never resolves (a typo'd scope) surfaces here in dev.
      if (isDevMode()) console.warn(error);
      return;
    }
    off?.();
    bound = client;
    off = next;
  };

  bind();
  const unsubscribe = source.subscribe(bind);
  inject(DestroyRef).onDestroy(() => {
    unsubscribe();
    off?.();
  });
}
