// Ported from packages/core/src/react/model-context/useInteractable.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/model-context/useInteractableState.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/model-context/useInteractableVersions.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { computed, type Signal, type Type } from '@angular/core';
import { unstable_getInteractableVersions } from '@assistant-ui/core';
import type {
  Unstable_InferInteractableState,
  Unstable_InteractableStateSchema,
  Unstable_InteractableVersionInfo,
} from '@assistant-ui/core/react';
import { bindToClient, type ClientBinding } from '../model-context/bind-client';
import { readMaybeSignal, type MaybeSignal } from '../model-context/instructions';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import type { ToolUIComponent } from '../tools/tool-ui';
import {
  interactableToolName,
  isInteractableCreateCall,
  nextInteractableId,
  toolResultRecord,
} from './helpers';

/** What a state updater accepts: the next state, or a function of the previous one. */
export type InteractableStateUpdater<TState> = TState | ((prev: TState) => TState);

/** The configuration of {@link unstable_injectInteractable}. */
export interface InteractableConfig<TSchema extends Unstable_InteractableStateSchema> {
  /** What the interactable is, for the model. */
  description: string;
  /** JSON Schema or Standard Schema (for example Zod) describing the state. */
  stateSchema: TSchema;
  /** The state until the interactable registers or the model changes it. */
  initialState: Unstable_InferInteractableState<TSchema>;
  /**
   * Unique instance id; required to address this instance when several
   * interactables share a name. Generated when omitted.
   */
  id?: string | undefined;
  /**
   * Component installed as the tool UI for this interactable's `update_{name}`
   * tool calls (the `tool` input contract of `registerToolUI`). Prefer
   * `unstable_interactableTool`, which wires this up.
   */
  updateRender?: Type<ToolUIComponent> | undefined;
}

/** The result of {@link unstable_injectInteractableState}. */
export interface InteractableStateHandle<TState> {
  /** The live state; `undefined` until the owning interactable registers. */
  state: Signal<TState | undefined>;
  /** Replaces the state or updates it from the previous one. */
  setState: (updater: InteractableStateUpdater<TState>) => void;
  /** Whether a persistence save is pending. */
  isPending: Signal<boolean>;
  /** The last persistence error, if any. */
  error: Signal<unknown>;
  /** Resolves once pending persistence work has finished. */
  flush: () => Promise<void>;
}

/** The result of {@link unstable_injectInteractable}. */
export interface InteractableHandle<TState> {
  /** The live state (the config's `initialState` until registered). */
  state: Signal<TState>;
  /** The instance id (given, inferred from the surrounding tool call, or generated). */
  id: Signal<string>;
  /**
   * This message's version of the instance when rendered inside a
   * tool-created interactable message part; `undefined` elsewhere.
   */
  version: Signal<Unstable_InteractableVersionInfo<TState> | undefined>;
  /** Replaces the state or updates it from the previous one. */
  setState: (updater: InteractableStateUpdater<TState>) => void;
  /** Whether a persistence save is pending. */
  isPending: Signal<boolean>;
  /** The last persistence error, if any. */
  error: Signal<unknown>;
  /** Resolves once pending persistence work has finished. */
  flush: () => Promise<void>;
  /** Re-evaluates the registration (call after changing inputs the config reads). */
  sync: ClientBinding['sync'];
}

const jsonEqual = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

/**
 * Reads and writes the state of an interactable registered elsewhere, by id
 * (React's `unstable_useInteractableState`). Use it from secondary readers;
 * the owning component registers with {@link unstable_injectInteractable}.
 * `state` is `undefined` until the owner registers. Needs the
 * `unstable_interactables` scope (`unstable_Interactables()` in `AuiConfig`).
 *
 * @deprecated Experimental since 2026-06-23. Not scheduled for removal; the API may change in any release.
 */
export function unstable_injectInteractableState<TState>(
  id: MaybeSignal<string>,
): InteractableStateHandle<TState> {
  const aui = injectAui();
  const state = injectAuiState(
    (s) => s.unstable_interactables.definitions[readMaybeSignal(id)]?.state,
  ) as Signal<TState | undefined>;
  const persistence = injectAuiState(
    (s) => s.unstable_interactables.persistence[readMaybeSignal(id)],
  );
  return {
    state,
    setState: (updater) => {
      aui
        .unstable_interactables()
        .setState(readMaybeSignal(id), (prev) =>
          typeof updater === 'function'
            ? (updater as (prev: TState) => TState)(prev as TState)
            : updater,
        );
    },
    isPending: computed(() => persistence()?.isPending ?? false),
    error: computed(() => persistence()?.error),
    flush: () => aui.unstable_interactables().flush(),
  };
}

/**
 * Every version of a tool-created interactable recorded in the current
 * thread, oldest first (React's `unstable_useInteractableVersions`): the
 * creating tool call, each user edit and each `update_*` call. Each entry
 * carries the state as of that version and a `restore()` that sets the live
 * instance back to it.
 *
 * @deprecated Experimental since 2026-06-23. Not scheduled for removal; the API may change in any release.
 */
export function unstable_injectInteractableVersions<TState = unknown>(
  id: MaybeSignal<string>,
  name: MaybeSignal<string>,
): Signal<
  (Omit<ReturnType<typeof unstable_getInteractableVersions>[number], 'state'> & {
    state: TState;
    restore: () => void;
  })[]
> {
  const { setState } = unstable_injectInteractableState<TState>(id);
  const versions = injectAuiState((s) => s.thread.messages);
  const folded = computed(
    () => unstable_getInteractableVersions(versions(), readMaybeSignal(id), readMaybeSignal(name)),
    { equal: jsonEqual },
  );
  return computed(() =>
    folded().map((v) => ({
      ...v,
      state: v.state as TState,
      restore: () => setState(v.state as TState),
    })),
  );
}

/**
 * Registers an interactable with the assistant and returns its live state,
 * like a signal the model can also read and update (React's
 * `unstable_useInteractable`). It registers for the injector's lifetime.
 *
 * `config` may be an object or a function returning one; the function form
 * is re-read on every store change and after first render, so it can read
 * signals (call the returned `sync()` for changes the store does not see).
 * Inside tool-call message parts `version` carries this message's version of
 * the instance, and inside an `update_{name}` part the id is inferred from
 * the call.
 *
 * @deprecated Experimental since 2026-06-23. Not scheduled for removal; the API may change in any release.
 */
export function unstable_injectInteractable<TSchema extends Unstable_InteractableStateSchema>(
  name: MaybeSignal<string>,
  config: InteractableConfig<TSchema> | (() => InteractableConfig<TSchema>),
): InteractableHandle<Unstable_InferInteractableState<TSchema>> {
  type TState = Unstable_InferInteractableState<TSchema>;
  const getConfig = typeof config === 'function' ? config : () => config;
  const autoId = nextInteractableId();

  const part = injectAuiState((s) => {
    const p = s.optional.part;
    return p?.type === 'tool-call' ? p : undefined;
  });

  const resolved = computed(() => {
    const interactableName = readMaybeSignal(name);
    const p = part();
    const updateToolName = interactableToolName(interactableName);
    // Inside an update_{name} part the instance id comes from the call itself:
    // the result's resolved id (covers id-less calls), or the id argument.
    let inferredId: string | undefined;
    if (p?.toolName === updateToolName) {
      const result = toolResultRecord(p.result);
      const args = p.args as Record<string, unknown> | undefined;
      if (result?.['success'] !== false) {
        if (typeof result?.['id'] === 'string') inferredId = result['id'];
        else if (typeof args?.['id'] === 'string') inferredId = args['id'];
      }
    }
    const id = getConfig().id ?? inferredId ?? autoId;
    const internalScope =
      p?.toolName === interactableName ||
      p?.toolName === updateToolName ||
      (p !== undefined && isInteractableCreateCall(p, id, interactableName))
        ? ('thread' as const)
        : undefined;
    return { id, name: interactableName, internalScope };
  });
  const id = computed(() => resolved().id);

  const binding = bindToClient(
    unstable_injectInteractable,
    (client) => {
      const { id, name: interactableName, internalScope } = resolved();
      const c = getConfig();
      return client.unstable_interactables().register({
        id,
        name: interactableName,
        description: c.description,
        stateSchema: c.stateSchema,
        initialState: c.initialState,
        // The tools scope types renderers as React components; Angular
        // component classes are stored there (see `registerToolUI`).
        updateRender: c.updateRender as never,
        ...(internalScope ? { scope: internalScope } : {}),
      } as Parameters<ReturnType<typeof client.unstable_interactables>['register']>[0]);
    },
    () => {
      const r = resolved();
      const c = getConfig();
      return [r.id, r.name, r.internalScope, c.description, c.stateSchema, c.updateRender];
    },
  );

  const shared = unstable_injectInteractableState<TState>(id);

  const messages = injectAuiState((s) =>
    resolved().internalScope ? s.thread.messages : undefined,
  );
  const versionValue = computed(
    () => {
      const msgs = messages();
      const toolCallId = part()?.toolCallId;
      if (!msgs || !toolCallId) return undefined;
      const { id: instanceId, name: interactableName } = resolved();
      const versions = unstable_getInteractableVersions(msgs, instanceId, interactableName);
      if (!versions.some((v) => v.origin === 'create' && v.toolCallId === instanceId)) {
        return undefined;
      }
      const mine = versions.find((v) => v.toolCallId === toolCallId);
      if (!mine) return undefined;
      const latestToolCallId = [...versions]
        .reverse()
        .find((v) => v.toolCallId !== undefined)?.toolCallId;
      return { state: mine.state, isLatest: latestToolCallId === toolCallId };
    },
    { equal: jsonEqual },
  );
  const version = computed<Unstable_InteractableVersionInfo<TState> | undefined>(() => {
    const value = versionValue();
    return (
      value && {
        state: value.state as TState,
        isLatest: value.isLatest,
        restore: () => shared.setState(value.state as TState),
      }
    );
  });

  return {
    state: computed(() => {
      const registered = shared.state();
      return (registered === undefined ? getConfig().initialState : registered) as TState;
    }),
    id,
    version,
    setState: shared.setState,
    isPending: shared.isPending,
    error: shared.error,
    flush: shared.flush,
    sync: binding.sync,
  };
}
