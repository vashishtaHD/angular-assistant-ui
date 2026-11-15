// Ported from packages/core/src/react/model-context/interactableTool.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
/* eslint-disable @typescript-eslint/no-explicit-any -- the core `Tool` contract is generic over its argument types; entries of mixed tools are `Tool<any, any>` */
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  isDevMode,
  type InputSignal,
  type Type,
} from '@angular/core';
import type {
  Unstable_InferInteractableState,
  Unstable_InteractableStateSchema,
  Unstable_InteractableVersionInfo,
} from '@assistant-ui/core/react';
import { sanitizedName, toolResultRecord, UPDATE_TOOL_PREFIX } from './helpers';
import {
  unstable_injectInteractable,
  unstable_injectInteractableState,
  type InteractableStateUpdater,
} from './inject-interactable';
import type { AuiToolDefinition } from '../tools/register-tool';
import type { ToolUIProps } from '../tools/tool-ui';

/**
 * The value of the single `interactable` input a render component of
 * {@link unstable_interactableTool} receives.
 *
 * @deprecated Experimental since 2026-06-23. Not scheduled for removal; the API may change in any release.
 */
export interface Unstable_InteractableToolRenderProps<TState> {
  /**
   * The live state. While `streaming` is true, fields the model has not
   * finished generating may still be missing.
   */
  state: TState;
  /** Replaces the state or updates it from the previous one. */
  setState: (updater: InteractableStateUpdater<TState>) => void;
  /**
   * This message's version of the instance: its state as of this point in
   * the conversation, whether it is the most recent edit and a `restore()`
   * back to it. `undefined` while streaming.
   */
  version: Unstable_InteractableVersionInfo<TState> | undefined;
  /** The instance id. */
  id: string;
  /** True while the tool call's arguments are still streaming in. */
  streaming: boolean;
}

/**
 * The contract a render component of {@link unstable_interactableTool}
 * implements: one required `interactable` input
 * (`interactable = input.required<Unstable_InteractableToolRenderProps<MyState>>()`).
 */
export interface InteractableToolRenderComponent<TState = any> {
  /** The live interactable state and controls. */
  readonly interactable: InputSignal<Unstable_InteractableToolRenderProps<TState>>;
}

/**
 * Configuration of {@link unstable_interactableTool}.
 *
 * @deprecated Experimental since 2026-06-23. Not scheduled for removal; the API may change in any release.
 */
export interface Unstable_InteractableToolConfig<TSchema extends Unstable_InteractableStateSchema> {
  /**
   * The interactable's name, which names its generated `update_{name}` tool
   * and its versions. Defaults to the toolkit entry key.
   */
  name?: string | undefined;
  /** What the interactable is, for the model. */
  description: string;
  /** JSON Schema or Standard Schema describing the state. */
  stateSchema: TSchema;
  /** Component rendering the interactable at the creating call and every update call. */
  render:
    | Type<InteractableToolRenderComponent<Unstable_InferInteractableState<TSchema>>>
    | Type<InteractableToolRenderComponent>;
}

type AnyConfig = Unstable_InteractableToolConfig<Unstable_InteractableStateSchema>;

/**
 * Configs by tool name (toolkit key, interactable name and its sanitized update
 * name), filled by `registerToolkit`. Each key holds the registrations that
 * claimed it, so a toolkit mounted twice survives one copy being destroyed.
 */
const configs = new Map<string, { config: AnyConfig; token: object }[]>();

/** Marker property carrying the config on a definition made by {@link unstable_interactableTool}. */
export const INTERACTABLE_TOOL_CONFIG = Symbol.for('assistant-ui-angular.interactableToolConfig');

/**
 * Makes the render config of an interactable tool findable by the tool UIs
 * for `toolName` (its toolkit key) until the returned function is called.
 * `registerToolkit` does this for you; call it yourself when mounting the
 * toolkit through core's `Tools({ toolkit })`.
 */
export function registerInteractableToolConfig(
  toolName: string,
  tool: AuiToolDefinition<any, any>,
): () => void {
  const config = (tool as { [INTERACTABLE_TOOL_CONFIG]?: AnyConfig })[INTERACTABLE_TOOL_CONFIG];
  if (!config) return () => undefined;
  // `update_*` calls carry the sanitized name, so register that spelling too.
  const names = [toolName, config.name].filter((k): k is string => !!k);
  const keys = names.flatMap((n) => [n, sanitizedName(n)]);
  const token = {};
  for (const key of new Set(keys))
    configs.set(key, [...(configs.get(key) ?? []), { config, token }]);
  return () => {
    for (const key of new Set(keys)) {
      const rest = (configs.get(key) ?? []).filter((entry) => entry.token !== token);
      if (rest.length > 0) configs.set(key, rest);
      else configs.delete(key);
    }
  };
}

const noop = () => undefined;

const warnedMissing = new Set<string>();

/** Resolves the config for `toolName`, warning once per name in dev when it is missing. */
function configFor(toolName: string): AnyConfig | undefined {
  const config = configs.get(toolName)?.at(-1)?.config;
  if (!config && isDevMode() && !warnedMissing.has(toolName)) {
    warnedMissing.add(toolName);
    console.warn(
      `unstable_interactableTool: no config found for "${toolName}". Register the toolkit with registerToolkit() (or registerInteractableToolConfig()).`,
    );
  }
  return config;
}

/**
 * Internal: registers the instance and renders the config's component with
 * the live state.
 */
@Component({
  selector: 'aui-interactable-anchor',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<ng-container *ngComponentOutlet="config().render; inputs: inputs()" />`,
})
export class AuiInteractableAnchorComponent {
  /** The interactable's name. */
  readonly name = input.required<string>();
  /** The instance id (the creating call's id), or undefined to infer it. */
  readonly instanceId = input<string | undefined>(undefined);
  /** The state to start from. */
  readonly initial = input.required<unknown>();
  /** The tool config. */
  readonly config = input.required<AnyConfig>();
  /** The `update_*` tool UI to install. */
  readonly updateRender = input.required<Type<unknown>>();

  private readonly handle = unstable_injectInteractable(
    () => this.name(),
    () => ({
      id: this.instanceId(),
      description: this.config().description,
      stateSchema: this.config().stateSchema,
      initialState: this.initial(),
      updateRender: this.updateRender() as never,
    }),
  );

  /** The `interactable` input of the user's render component. */
  protected readonly inputs = computed(() => ({
    interactable: {
      state: this.handle.state(),
      setState: this.handle.setState,
      version: this.handle.version(),
      id: this.handle.id(),
      streaming: false,
    } satisfies Unstable_InteractableToolRenderProps<unknown>,
  }));
}

/** Internal: renders the config's component for a streaming `update_*` call. */
@Component({
  selector: 'aui-interactable-streaming',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `@if (shared.state() !== undefined) {
    <ng-container *ngComponentOutlet="config().render; inputs: inputs()" />
  }`,
})
export class AuiInteractableStreamingComponent {
  /** The instance id. */
  readonly instanceId = input.required<string>();
  /** The tool config. */
  readonly config = input.required<AnyConfig>();

  /** The shared state of the instance. */
  protected readonly shared = unstable_injectInteractableState<unknown>(() => this.instanceId());

  /** The `interactable` input of the user's render component. */
  protected readonly inputs = computed(() => ({
    interactable: {
      state: this.shared.state(),
      setState: this.shared.setState,
      version: undefined,
      id: this.instanceId(),
      streaming: true,
    } satisfies Unstable_InteractableToolRenderProps<unknown>,
  }));
}

/** Internal: the tool UI for `update_{name}` calls. */
@Component({
  selector: 'aui-interactable-update-tool-ui',
  standalone: true,
  imports: [AuiInteractableAnchorComponent, AuiInteractableStreamingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @switch (view().kind) {
      @case ('streaming') {
        <aui-interactable-streaming [instanceId]="view().id" [config]="view().config!" />
      }
      @case ('anchor') {
        <aui-interactable-anchor
          [name]="view().name"
          [initial]="view().initial"
          [config]="view().config!"
          [updateRender]="updateRender"
        />
      }
    }
  `,
})
export class AuiInteractableUpdateToolUiComponent {
  /** The tool-call part and its callbacks. */
  readonly tool = input.required<ToolUIProps>();
  /** This component, installed as the `update_*` tool UI. */
  protected readonly updateRender = AuiInteractableUpdateToolUiComponent;

  /** What the update call shows. */
  protected readonly view = computed(() => {
    const none = {
      kind: 'none',
      id: '',
      name: '',
      initial: undefined as unknown,
      config: undefined as AnyConfig | undefined,
    };
    const part = this.tool().part;
    const name = part.toolName.slice(UPDATE_TOOL_PREFIX.length);
    const config = configFor(name);
    if (!config) return none;
    const args = (part.args ?? {}) as Record<string, unknown>;
    if (part.result === undefined) {
      return typeof args['id'] === 'string'
        ? { ...none, kind: 'streaming', id: args['id'], config }
        : none;
    }
    if (toolResultRecord(part.result)?.['success'] === false) return none;
    const partial: Record<string, unknown> = { ...args };
    delete partial['id'];
    return { ...none, kind: 'anchor', name: config.name ?? name, initial: partial, config };
  });
}

/** Internal: the tool UI for the creating call of an interactable tool. */
@Component({
  selector: 'aui-interactable-tool-ui',
  standalone: true,
  imports: [NgComponentOutlet, AuiInteractableAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (view(); as v) {
      @if (v.streaming) {
        <ng-container *ngComponentOutlet="v.config.render; inputs: v.inputs" />
      } @else {
        <aui-interactable-anchor
          [name]="v.name"
          [instanceId]="v.id"
          [initial]="v.state"
          [config]="v.config"
          [updateRender]="updateRender"
        />
      }
    }
  `,
})
export class AuiInteractableToolUiComponent {
  /** The tool-call part and its callbacks. */
  readonly tool = input.required<ToolUIProps>();
  /** The `update_*` tool UI to install. */
  protected readonly updateRender = AuiInteractableUpdateToolUiComponent;

  /** What the creating call shows. */
  protected readonly view = computed(() => {
    const part = this.tool().part;
    const config = configFor(part.toolName);
    if (!config) return undefined;
    const state = part.args as unknown;
    const streaming = part.result === undefined;
    return {
      config,
      streaming,
      state,
      id: part.toolCallId,
      name: config.name ?? part.toolName,
      inputs: {
        interactable: {
          state,
          setState: noop,
          version: undefined,
          id: part.toolCallId,
          streaming: true,
        } satisfies Unstable_InteractableToolRenderProps<unknown>,
      },
    };
  });
}

/**
 * Defines a tool that creates a thread-scoped interactable from its
 * arguments, for assignment to a toolkit entry (React's
 * `unstable_interactableTool`). The entry key is the creating tool's name,
 * and the interactable's unless `name` gives it another:
 *
 * ```ts
 * registerToolkit({
 *   notepad: unstable_interactableTool({
 *     description: 'A notepad the user can read and edit.',
 *     stateSchema: notepadSchema,
 *     render: NotepadComponent,
 *   }),
 * });
 * ```
 *
 * `render` is a component with one required `interactable` input
 * ({@link InteractableToolRenderComponent}). It shows at the creating call
 * and, installed automatically, at every `update_{name}` call, with streaming
 * previews and instance-id wiring handled. Needs the `unstable_interactables`
 * scope and a toolkit mounted with `registerToolkit` (which makes the config
 * findable by the tool UIs).
 *
 * @deprecated Experimental since 2026-06-23. Not scheduled for removal; the API may change in any release.
 */
export function unstable_interactableTool<TSchema extends Unstable_InteractableStateSchema>(
  config: Unstable_InteractableToolConfig<TSchema>,
): AuiToolDefinition<
  Record<string, unknown>,
  { success: true; interactable?: string | undefined }
> {
  const definition = {
    type: 'frontend',
    description: config.description,
    parameters: config.stateSchema,
    display: 'standalone',
    // The result names the interactable when the tool is named apart from it,
    // so the thread record alone shows which interactable this call created.
    execute: async () =>
      config.name === undefined
        ? { success: true as const }
        : { success: true as const, interactable: config.name },
    render: AuiInteractableToolUiComponent as never,
  } as unknown as AuiToolDefinition<
    Record<string, unknown>,
    { success: true; interactable?: string | undefined }
  >;
  // Non-enumerable so it never leaks into the model-facing tool.
  Object.defineProperty(definition, INTERACTABLE_TOOL_CONFIG, { value: config });
  return definition;
}
