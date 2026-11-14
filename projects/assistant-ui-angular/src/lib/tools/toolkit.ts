// Ported from packages/core/src/react/client/Tools.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/model-context/useAuiToolOverrides.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
/* eslint-disable @typescript-eslint/no-explicit-any -- the core `Tool` contract is generic over its argument types; entries of mixed tools are `Tool<any, any>` */
import { DestroyRef, assertInInjectionContext, inject } from '@angular/core';
import type { Unsubscribe } from '@assistant-ui/store/client';
import type { Tool } from 'assistant-stream';
import { bindToClient } from '../model-context/bind-client';
import { readMaybeSignal, type MaybeSignal } from '../model-context/instructions';
import { registerInteractableToolConfig } from '../interactables/interactable-tool';
import { setToolDisplay, toModelTool, type AuiToolDefinition } from './register-tool';

/**
 * A named collection of tools for {@link registerToolkit}. Keys are the tool
 * names the model receives. Entries are {@link AuiToolDefinition}s; `mcp`
 * entries (see `defineMcpToolkit`) are display-only here and are not sent
 * through model context.
 */
export type AuiToolkit = Record<string, AuiToolDefinition<any, any>>;

/**
 * Registers every tool of `toolkit` with the model context and installs their
 * tool-call UIs, for the lifetime of the injection context (the Angular
 * counterpart of mounting `Tools({ toolkit })`). `type: 'mcp'` entries are
 * skipped for model context. Everything unregisters on destroy.
 *
 * To mount a toolkit once for a whole provider instead, pass it to core's
 * `Tools({ toolkit })` resource in `AuiConfig`.
 *
 * @example
 * ```ts
 * registerToolkit({
 *   get_weather: { type: 'frontend', description: '…', parameters, execute, render: WeatherCardComponent },
 *   confirm: { type: 'human', description: '…', parameters, render: ConfirmComponent },
 * });
 * ```
 */
export function registerToolkit(toolkit: AuiToolkit): void {
  assertInInjectionContext(registerToolkit);
  const releases = Object.entries(toolkit).map(([name, tool]) =>
    registerInteractableToolConfig(name, tool),
  );
  inject(DestroyRef).onDestroy(() => {
    for (const release of releases) release();
  });
  const tools: Record<string, Tool<any, any>> = Object.create(null);
  for (const [name, tool] of Object.entries(toolkit)) {
    if (tool.type === 'mcp') continue;
    tools[name] = toModelTool(tool);
  }
  const context = { tools };

  bindToClient(registerToolkit, (client) => {
    const offs: Unsubscribe[] = [];
    const undo = () => {
      for (const off of offs.splice(0)) off();
    };
    try {
      for (const [name, tool] of Object.entries(toolkit)) {
        const off = setToolDisplay(client, name, tool);
        if (off) offs.push(off);
      }
      offs.push(client.modelContext().register({ getModelContext: () => context }));
    } catch (error) {
      undo();
      throw error;
    }
    return undo;
  });
}

/** Overrides for toolkit entries: partial tool definitions keyed by tool name. */
export type AuiToolOverrides = Record<string, Partial<Tool<any, any>>>;

/**
 * Overrides toolkit entries (typically the executor of a `stubTool()` entry)
 * for the injector's lifetime (React's `useAuiToolOverrides`). The overrides
 * register at priority 1000, above toolkit defaults, and are read each time
 * the model context is pulled, so a signal of overrides stays current. Keep
 * the keys stable after creation.
 *
 * @deprecated Experimental since 2026-06-03. Not scheduled for removal; the API may change in any release.
 */
export function injectAuiToolOverrides(overrides: MaybeSignal<AuiToolOverrides>): void {
  bindToClient(injectAuiToolOverrides, (client) =>
    client.modelContext().register({
      getModelContext: () => ({
        priority: 1000,
        tools: readMaybeSignal(overrides) as Record<string, Tool<any, any>>,
      }),
    }),
  );
}
