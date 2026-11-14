// Ported from packages/core/src/react/model-context/useAssistantTool.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/model-context/makeAssistantTool.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
/* eslint-disable @typescript-eslint/no-explicit-any -- the core `Tool` contract is generic over its argument types; entries of mixed tools are `Tool<any, any>` */
import type { Type } from '@angular/core';
import type { AssistantClient, Unsubscribe } from '@assistant-ui/store/client';
import type { Tool } from 'assistant-stream';
import { bindToClient } from '../model-context/bind-client';
import type { ToolsScopeRender, ToolUIComponent } from './tool-ui';
import type { ToolCallText } from '@assistant-ui/core/react';

/**
 * The Angular face of a tool-call display: the fields a tool definition may
 * carry beyond what reaches the model. They stay client-side.
 */
export interface AuiToolDisplay<TArgs extends Record<string, unknown>, TResult> {
  /**
   * Component rendered for calls to this tool, with the `tool` input
   * ({@link ToolUIComponent}). Required for `human` tools.
   */
  render?: Type<ToolUIComponent> | undefined;
  /** Lightweight text shown while a call is running or complete (instead of a component). */
  renderText?: ToolCallText<TArgs, TResult> | undefined;
}

/**
 * A tool as {@link registerTool} and {@link registerToolkit} accept it: the
 * core `Tool` contract (`type: 'frontend' | 'human' | ...`, `description`,
 * `parameters`, `execute`) plus the client-only display fields.
 */
export type AuiToolDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> = Tool<TArgs, TResult> & AuiToolDisplay<TArgs, TResult>;

/**
 * Props used to register a tool (React's `AssistantToolProps`): a tool
 * definition and its `toolName`.
 */
export type AssistantToolProps<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> = AuiToolDefinition<TArgs, TResult> & {
  /** The name the model calls the tool by. */
  toolName: string;
};

/**
 * What {@link makeAssistantTool} returns: calling it (in an injection
 * context) registers the tool, like React's `<Tool />` component.
 */
export type AssistantTool = (() => void) & {
  /** The tool definition this registrar installs. */
  unstable_tool: AssistantToolProps<any, any>;
};

type ToolsSetToolUI = (
  toolName: string,
  render: ToolsScopeRender,
  options?: { standalone?: boolean; renderText?: ToolCallText<any, any> },
) => Unsubscribe;

/** Placeholder renderer for text-only tool displays (`renderText` wins at render time). */
class TextOnlyToolUI {}

/**
 * Resolves whether a tool's UI is presented standalone (outside a chain of
 * thought trace): an explicit `display` wins, otherwise `human` tools are
 * standalone.
 */
export function isStandaloneTool(tool: Pick<Tool<any, any>, 'type' | 'display'>): boolean {
  if (tool.display !== undefined) return tool.display === 'standalone';
  return tool.type === 'human';
}

/** Strips the client-only fields; what remains is what the model sees. */
export function toModelTool(tool: AuiToolDefinition<any, any>): Tool<any, any> {
  // `render`, `renderText` and `display` never reach the model.
  const rest: Record<string, unknown> = { ...tool };
  delete rest['render'];
  delete rest['renderText'];
  delete rest['display'];
  return rest as unknown as Tool<any, any>;
}

/** Installs the tool UI of `tool` on `client`, or returns `undefined` when it has none. */
export function setToolDisplay(
  client: AssistantClient,
  toolName: string,
  tool: AuiToolDefinition<any, any>,
): Unsubscribe | undefined {
  const render = tool.render ?? (tool.renderText ? TextOnlyToolUI : undefined);
  if (!render) return undefined;
  const setToolUI = client.tools.setToolUI as unknown as ToolsSetToolUI;
  return setToolUI(toolName, render as unknown as ToolsScopeRender, {
    standalone: isStandaloneTool(tool),
    renderText: tool.renderText,
  });
}

/**
 * Registers a frontend (or human-in-the-loop) tool with the assistant's model
 * context for the lifetime of the injection context (React's
 * `useAssistantTool`). The tool is added to `getModelContext().tools`, its
 * `execute` runs in the browser when the model calls it, and a `human` tool
 * waits for the UI to call `addResult`. When `render` or `renderText` is given
 * it is also installed as the tool-call UI (the same registry as
 * `registerToolUI`). Everything unregisters on destroy.
 *
 * Must be called in an injection context under an `[auiProvider]` whose
 * config mounts `modelContext` and `tools` scopes (`RuntimeAdapter` mounts
 * both).
 *
 * @example
 * ```ts
 * constructor() {
 *   registerTool({
 *     toolName: 'get_weather',
 *     type: 'frontend',
 *     description: 'Get the weather for a city.',
 *     parameters: { type: 'object', properties: { city: { type: 'string' } } },
 *     execute: async ({ city }: { city: string }) => fetchWeather(city),
 *     render: WeatherCardComponent,
 *   });
 * }
 * ```
 */
export function registerTool<TArgs extends Record<string, unknown>, TResult>(
  tool: AssistantToolProps<TArgs, TResult>,
): void {
  const { toolName } = tool;
  const context = { tools: { [toolName]: toModelTool(tool) } };
  bindToClient(registerTool, (client) => {
    const offUI = setToolDisplay(client, toolName, tool);
    let offContext: Unsubscribe;
    try {
      offContext = client.modelContext().register({ getModelContext: () => context });
    } catch (error) {
      offUI?.();
      throw error;
    }
    return () => {
      offContext();
      offUI?.();
    };
  });
}

/**
 * Creates a registrar for a tool (React's `makeAssistantTool`): call the
 * returned function in an injection context to register the tool, for
 * example from a component constructor, instead of calling
 * {@link registerTool} directly. Useful for exporting reusable tool modules.
 *
 * @example
 * ```ts
 * export const WeatherTool = makeAssistantTool({ toolName: 'get_weather', ... });
 * // in a component: constructor() { WeatherTool(); }
 * ```
 */
export function makeAssistantTool<TArgs extends Record<string, unknown>, TResult>(
  tool: AssistantToolProps<TArgs, TResult>,
): AssistantTool {
  const registrar = (() => registerTool(tool)) as AssistantTool;
  registrar.unstable_tool = tool;
  return registrar;
}
