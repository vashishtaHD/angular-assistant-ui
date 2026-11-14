// Ported from packages/vue/src/useAuiState.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  DestroyRef,
  assertInInjectionContext,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import { getProxiedAssistantState, type AssistantState } from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

/**
 * Subscribes to a slice of `AssistantState` and returns it as a signal.
 * Must be called in an injection context; the subscription ends when that
 * context is destroyed.
 *
 * The `selector` runs on every store update; dependents are notified only
 * when the selected slice changes by `Object.is`. Returning the entire state
 * object is not supported and throws — select a specific field instead, or
 * compose multiple `injectAuiState` calls. Returning a fresh object or array
 * literal notifies dependents on every update; select primitives or a
 * memoized reference.
 *
 * Scopes that may be unavailable can be read via `s.optional.<scope>`, which
 * resolves to `undefined` instead of throwing.
 *
 * Works with Zone.js and zoneless change detection: store updates write a
 * signal, which schedules rendering of the views that read it.
 *
 * @example
 * ```ts
 * readonly isRunning = injectAuiState((s) => s.thread.isRunning);
 * // template: <button [disabled]="isRunning()">…</button>
 * ```
 */
export function injectAuiState<T>(selector: (state: AssistantState) => T): Signal<T> {
  assertInInjectionContext(injectAuiState);
  const { source } = injectAuiContext();

  const version = signal(0);
  const unsubscribe = source.subscribe(() => {
    version.update((v) => v + 1);
  });
  inject(DestroyRef).onDestroy(unsubscribe);

  return computed(
    () => {
      version();
      const state = getProxiedAssistantState(source.getClient());
      const slice = selector(state);

      if (
        typeof slice === 'object' &&
        slice !== null &&
        ((slice as unknown) === state || (slice as unknown) === state.optional)
      ) {
        throw new Error(
          'You tried to return the entire AssistantState. This is not supported due to technical limitations.',
        );
      }

      return slice;
    },
    { equal: Object.is },
  );
}
