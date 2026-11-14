// Ported from packages/core/src/react/providers/TextMessagePartProvider.tsx @ 7d74276
// (internal: the public TextMessagePartProvider port belongs to a later task)
import { resource } from '@assistant-ui/tap';
import { AuiConfig, type ClientOutput } from '@assistant-ui/store/client';
import type { PartState } from '@assistant-ui/core/store';

const unsupported = (): never => {
  throw new Error('Not supported');
};

const TextPartClient = resource(
  ({ text, isRunning }: { text: string; isRunning: boolean }): ClientOutput<'part'> => {
    const state = {
      type: 'text',
      text,
      status: isRunning ? { type: 'running' } : { type: 'complete' },
    } as PartState;
    return {
      getState: () => state,
      addToolResult: unsupported,
      resumeToolCall: unsupported,
      respondToToolApproval: unsupported,
      unstable_recordInteraction: async () => unsupported(),
    };
  },
);

/**
 * The scope config for a static text part (`s.part`): `{ type: 'text', text,
 * status: running | complete }`, so primitives such as `aui-part-text` and
 * `*auiPartInProgress` work outside a message's real parts. Render it with
 * `AuiScopeOutletComponent`.
 */
export function textPartScopeConfig(text: string, isRunning: boolean): AuiConfig {
  return AuiConfig({ part: TextPartClient({ text, isRunning }) });
}
