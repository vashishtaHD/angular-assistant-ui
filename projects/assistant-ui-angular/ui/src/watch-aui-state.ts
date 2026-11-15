// Angular addition (no upstream counterpart): the store-subscription seam the styled kit uses
// for transitions that must not depend on a render reading them (Vue's `watch` on `useAuiState`).
import { DestroyRef, afterNextRender, assertInInjectionContext, inject } from '@angular/core';
import { getProxiedAssistantState, type AssistantState } from '@assistant-ui/store/client';
import { AUI_CONTEXT } from 'angular-assistant-ui';

/**
 * Calls `onChange(value, previous)` every time the selected slice of the
 * store changes (by `Object.is`), straight from the store subscription, so a
 * transition is seen even when no render happens between two updates. The
 * first value is taken after the first render (stores are not read during
 * construction) and reported with `previous` set to `undefined`. Must be
 * called in an injection context under an `AuiProvider`; the subscription
 * ends when that context is destroyed.
 *
 * @internal Used by the styled kit; not part of the public API.
 */
export function watchAuiState<T>(
  selector: (state: AssistantState) => T,
  onChange: (value: T, previous: T | undefined) => void,
): void {
  assertInInjectionContext(watchAuiState);
  const { source } = inject(AUI_CONTEXT);
  let started = false;
  let destroyed = false;
  let last: T | undefined;

  const check = () => {
    if (!started || destroyed) return;
    let value: T;
    try {
      value = selector(getProxiedAssistantState(source.getClient()));
    } catch {
      // The scope is gone (its row is being torn down); keep the last value.
      return;
    }
    if (Object.is(value, last)) return;
    const previous = last;
    last = value;
    onChange(value, previous);
  };

  const unsubscribe = source.subscribe(check);
  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
    unsubscribe();
  });
  afterNextRender(() => {
    started = true;
    last = undefined;
    let value: T;
    try {
      value = selector(getProxiedAssistantState(source.getClient()));
    } catch {
      return;
    }
    last = value;
    onChange(value, undefined);
  });
}
