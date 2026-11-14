// Ported from packages/vue/src/primitives/MessagePrimitiveParts.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (the `ToolUIProps` / `DataUIProps` contracts and the `tools` scope seam)
import {
  DestroyRef,
  assertInInjectionContext,
  inject,
  isDevMode,
  type InputSignal,
  type Type,
} from '@angular/core';
import type { PartMethods } from '@assistant-ui/core/store';
import {
  DefaultAssistantClient,
  type AssistantClient,
  type AssistantState,
  type Unsubscribe,
} from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

/**
 * The value of the single `tool` input passed to a tool UI registered in the
 * `tools` scope (see {@link registerToolUI}). React spreads the part state as
 * individual props; the Angular face passes one `tool` object instead, which
 * a component declares with `tool = input.required<ToolUIProps>()`.
 */
export interface ToolUIProps {
  /** The tool-call part being rendered. */
  part: Extract<AssistantState['part'], { type: 'tool-call' }>;
  /** Adds the tool result for this call. */
  addResult: PartMethods['addToolResult'];
  /** Resumes a tool call that is waiting for human input. */
  resume: PartMethods['resumeToolCall'];
  /** Responds to a server-side tool approval gate. */
  respondToApproval: PartMethods['respondToToolApproval'];
  /** @deprecated Experimental since 2026-09-23. Not scheduled for removal; the API may change in any release. */
  unstable_recordInteraction?: PartMethods['unstable_recordInteraction'];
}

/**
 * The value of the single `data` input passed to a data renderer registered
 * in the `dataRenderers` scope (`data = input.required<DataUIProps<T>>()`).
 */
export interface DataUIProps<T = unknown> {
  /** The data part being rendered, with its payload typed as `T`. */
  part: Omit<Extract<AssistantState['part'], { type: 'data' }>, 'data'> & {
    data: T;
  };
}

/**
 * The contract a tool UI component implements: a single required `tool`
 * input (`tool = input.required<ToolUIProps>()`).
 */
export interface ToolUIComponent {
  /** The tool-call part and its callbacks. */
  readonly tool: InputSignal<ToolUIProps>;
}

/**
 * The renderer type the `tools` scope declares (React's
 * `ToolCallMessagePartComponent`). Internal: only used at the cast seam.
 */
export type ToolsScopeRender = Parameters<AssistantClient['tools']['setToolUI']>[1];

/**
 * Registers `component` as the UI for tool calls named `toolName` in the
 * nearest provider's `tools` scope, for the lifetime of the current injection
 * context (it unregisters on destroy). Must be called in an injection context
 * under an {@link AuiProviderDirective} whose config mounts a `tools` scope
 * (`RuntimeAdapter` mounts one automatically).
 *
 * The registration follows the provider's current client: it is made once the
 * client exists (constructors run before the provider creates it) and moves
 * to a new client after a structural change. When a tool name is registered
 * more than once, the first live registration renders.
 *
 * @example
 * ```ts
 * @Component({ selector: 'app-tools', template: '' })
 * export class ToolsComponent {
 *   constructor() {
 *     registerToolUI('getWeather', WeatherCardComponent);
 *   }
 * }
 * ```
 */
export function registerToolUI(toolName: string, component: Type<ToolUIComponent>): void {
  assertInInjectionContext(registerToolUI);
  const { source } = injectAuiContext();
  // The tools scope types renderers as React components. The Angular face
  // stores an Angular component class there and casts it back at render
  // (`AuiPartViewComponent`); this is the one registration-side cast.
  const render = component as unknown as ToolsScopeRender;

  let bound: AssistantClient | undefined;
  let off: Unsubscribe | undefined;
  let destroyed = false;

  const bind = () => {
    if (destroyed) return;
    const client = source.getClient();
    if (client === bound) return;
    let next: Unsubscribe;
    try {
      next = client.tools.setToolUI(toolName, render);
    } catch (error) {
      // No `tools` scope on this client: the placeholder before the provider
      // creates its client, or a config without one. Retry on the next
      // structural change; only the latter is worth a dev warning.
      if (isDevMode() && client !== DefaultAssistantClient) console.warn(error);
      return;
    }
    off?.();
    bound = client;
    off = next;
  };

  bind();
  const unsubscribe = source.subscribe(bind);
  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
    unsubscribe();
    off?.();
    off = undefined;
  });
}
