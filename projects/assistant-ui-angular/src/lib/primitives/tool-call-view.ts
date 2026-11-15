// Ported from packages/vue/src/primitives/MessagePrimitiveParts.ts @ 7d74276
// (the tool-call branch of the inner `MessagePartView`)
import { computed, type Signal, type Type } from '@angular/core';
import { isMcpAppUri } from '@assistant-ui/core';
import { resolveToolCallText } from '@assistant-ui/core/store';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import type { ToolUIProps } from '../tools/tool-ui';

/** What a registered tool UI renders for the scoped tool-call part. */
export type RegisteredToolView =
  | { kind: 'value'; value: string | number }
  | { kind: 'component'; component: Type<unknown>; inputs: { tool: ToolUIProps } }
  | { kind: 'none' };

/**
 * Internal: resolves the UI registered for the tool-call part in scope (a
 * toolkit `renderText`, a registered component, or the MCP app renderer for
 * `ui://` resources). The signal holds `null` when the part is not a tool call
 * or nothing is registered for it. Call in an injection context inside a part
 * scope.
 */
export function injectRegisteredToolView(): Signal<RegisteredToolView | null> {
  const aui = injectAui();
  const part = injectAuiState((s) => s.part);
  const toolUI = injectAuiState((s) => {
    if (s.part.type !== 'tool-call') return null;
    return s.optional.tools?.toolUIs[s.part.toolName]?.[0] ?? null;
  });
  const mcpAppRender = injectAuiState((s) =>
    s.part.type === 'tool-call' && isMcpAppUri(s.part.mcp?.app?.resourceUri)
      ? (s.optional.tools?.mcpApp?.render ?? null)
      : null,
  );
  return computed<RegisteredToolView | null>(() => {
    const current = part();
    if (current.type !== 'tool-call') return null;
    const registration = toolUI();
    if (registration?.renderText) {
      const resolved = resolveToolCallText(registration.renderText, current);
      return typeof resolved === 'string' || typeof resolved === 'number'
        ? { kind: 'value', value: resolved }
        : { kind: 'none' };
    }
    const render = registration?.render ?? mcpAppRender();
    if (!render) return null;
    const tool: ToolUIProps = {
      part: current,
      addResult: aui.part.addToolResult,
      resume: aui.part.resumeToolCall,
      respondToApproval: aui.part.respondToToolApproval,
      ...(aui.part.unstable_recordInteraction && {
        unstable_recordInteraction: aui.part.unstable_recordInteraction,
      }),
    };
    // The tools scope types renderers as React components; the Angular face
    // stores Angular component classes there (`registerToolUI`), so this is
    // the one render-side cast back.
    return { kind: 'component', component: render as unknown as Type<unknown>, inputs: { tool } };
  });
}
