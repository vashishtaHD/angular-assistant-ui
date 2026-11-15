// Ported from packages/core/src/react/model-context/useAssistantInstructions.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (shared "register against the provider's current client" seam for Task 22)
import {
  DestroyRef,
  afterNextRender,
  assertInInjectionContext,
  inject,
  isDevMode,
} from '@angular/core';
import {
  DefaultAssistantClient,
  type AssistantClient,
  type Unsubscribe,
} from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

const sameKey = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));

/** The handle {@link bindToClient} returns. */
export interface ClientBinding {
  /** Re-evaluates the registration now (for example after an input changed). */
  sync(): void;
  /** Drops the current registration and makes a new one on the next sync. */
  reset(): void;
}

/**
 * Runs `register` against the nearest provider's client and keeps the
 * registration alive for the injection context's lifetime. The registration
 * is made as soon as a real client exists (constructors run before the
 * provider creates it), moves to a new client after a structural change, and
 * is undone on destroy.
 *
 * `register` may throw when the client lacks the needed scope (a placeholder
 * client, or a config without it); the binding retries on the next change.
 * Internal helper of the Task 22 functions.
 */
export function bindToClient(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  caller: Function,
  register: (client: AssistantClient) => Unsubscribe,
  getKey?: () => readonly unknown[],
): ClientBinding {
  assertInInjectionContext(caller);
  const { source } = injectAuiContext();
  let bound: AssistantClient | undefined;
  let boundKey: readonly unknown[] | undefined;
  let off: Unsubscribe | undefined;
  let destroyed = false;

  const sync = () => {
    if (destroyed) return;
    const client = source.getClient();
    let key: readonly unknown[] | undefined;
    if (getKey) {
      try {
        key = getKey();
      } catch {
        return; // inputs not available yet; the next sync retries
      }
    }
    if (client === bound && sameKey(key, boundKey)) return;
    // Same client, new key: release the old registration first so a keyed
    // registration (an interactable id) is never live twice.
    if (client === bound) {
      off?.();
      off = undefined;
    }
    let next: Unsubscribe;
    try {
      next = register(client);
    } catch (error) {
      if (isDevMode() && client !== DefaultAssistantClient) console.warn(error);
      return;
    }
    off?.();
    bound = client;
    boundKey = key;
    off = next;
  };

  const reset = () => {
    off?.();
    off = undefined;
    bound = undefined;
    boundKey = undefined;
    sync();
  };

  sync();
  // Keyed registrations read inputs that are set after construction.
  if (getKey) afterNextRender(sync);
  const unsubscribe = source.subscribe(sync);
  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
    unsubscribe();
    off?.();
    off = undefined;
  });
  return { sync, reset };
}
