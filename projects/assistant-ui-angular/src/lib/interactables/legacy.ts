// Ported from packages/core/src/react/interactables-legacy/useAssistantInteractable.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/interactables-legacy/useInteractableState.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { computed, type Signal } from '@angular/core';
import type { InteractableStateSchema } from '@assistant-ui/core/react';
import { bindToClient } from '../model-context/bind-client';
import { readMaybeSignal, type MaybeSignal } from '../model-context/instructions';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { nextInteractableId } from './helpers';
import type { InteractableStateUpdater } from './inject-interactable';

/**
 * Props of {@link injectAssistantInteractable}.
 *
 * @deprecated Since 2026-06-14, migrate to the unstable interactables API.
 */
export interface AssistantInteractableProps {
  /** What the interactable is, for the model. */
  description: string;
  /** JSON Schema or Standard Schema describing the state. */
  stateSchema: InteractableStateSchema;
  /** The state at registration. */
  initialState: unknown;
  /** Unique instance id; generated when omitted. */
  id?: string;
  /** Whether the interactable is the user's current selection. */
  selected?: boolean;
}

/**
 * Registers an interactable with the assistant for the injector's lifetime
 * and returns its instance id as a signal (React's `useAssistantInteractable`). Read and
 * write its state with {@link injectInteractableState}. `config` may be an
 * object or a function returning one; the function is first read after the
 * component's inputs are set (so it may read signal inputs) and re-read on
 * every store change. The id signal follows the config's `id`. Needs the
 * `interactables` scope (`Interactables()` from `angular-assistant-ui/react-interop`
 * in `AuiConfig`).
 *
 * @deprecated Since 2026-06-14, migrate to the unstable interactables API.
 */
export function injectAssistantInteractable(
  name: string,
  config: AssistantInteractableProps | (() => AssistantInteractableProps),
): Signal<string> {
  const getConfig = typeof config === 'function' ? config : () => config;
  const autoId = nextInteractableId();
  const id = computed(() => getConfig().id ?? autoId);
  bindToClient(
    injectAssistantInteractable,
    (client) => {
      const c = getConfig();
      return client.interactables().register({
        id: c.id ?? autoId,
        name,
        description: c.description,
        stateSchema: c.stateSchema,
        initialState: c.initialState,
        selected: c.selected,
      });
    },
    () => {
      const c = getConfig();
      return [c.id ?? autoId, name, c.description, c.stateSchema, c.selected];
    },
  );
  return id;
}

/** The result of {@link injectInteractableState}. */
export interface LegacyInteractableStateHandle<TState> {
  /** The live state (the fallback until the interactable registers). */
  state: Signal<TState>;
  /** Replaces the state or updates it from the previous one. */
  setState: (updater: InteractableStateUpdater<TState>) => void;
  /** Marks the interactable as selected or not. */
  setSelected: (selected: boolean) => void;
  /** Whether a persistence save is pending. */
  isPending: Signal<boolean>;
  /** The last persistence error, if any. */
  error: Signal<unknown>;
  /** Resolves once pending persistence work has finished. */
  flush: () => Promise<void>;
}

/**
 * Reads and writes the state of a registered interactable (React's
 * `useInteractableState`). Pair with {@link injectAssistantInteractable}.
 *
 * @deprecated Since 2026-06-14, migrate to the unstable interactables API.
 */
export function injectInteractableState<TState>(
  id: MaybeSignal<string>,
  fallback: TState,
): LegacyInteractableStateHandle<TState> {
  const aui = injectAui();
  const state = injectAuiState((s) => s.interactables.definitions[readMaybeSignal(id)]?.state);
  const persistence = injectAuiState((s) => s.interactables.persistence[readMaybeSignal(id)]);
  return {
    state: computed(() => (state() as TState | undefined) ?? fallback),
    setState: (updater) => {
      aui
        .interactables()
        .setState(readMaybeSignal(id), (prev) =>
          typeof updater === 'function'
            ? (updater as (prev: TState) => TState)(prev as TState)
            : updater,
        );
    },
    setSelected: (selected) => aui.interactables().setSelected(readMaybeSignal(id), selected),
    isPending: computed(() => persistence()?.isPending ?? false),
    error: computed(() => persistence()?.error),
    flush: () => aui.interactables().flush(),
  };
}
