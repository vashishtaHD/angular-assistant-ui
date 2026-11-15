// Ported from packages/core/src/react/providers/TextMessagePartProvider.tsx @ 7d74276
// (internal: the public TextMessagePartProvider port belongs to a later task)
import { resource } from '@assistant-ui/tap';
import { useEffect, useState } from '@assistant-ui/tap/react-shim';
import { AuiConfig, useAssistantClientRef, type ClientOutput } from '@assistant-ui/store/client';
import type { PartState } from '@assistant-ui/core/store';

const unsupported = (): never => {
  throw new Error('Not supported');
};

const RUNNING = { type: 'text', text: '', status: { type: 'running' } } as PartState;
const COMPLETE = { type: 'text', text: '', status: { type: 'complete' } } as PartState;

const EmptyMessagePartClient = resource((): ClientOutput<'part'> => {
  // Read from the enclosing message scope on every render instead of being passed in, so the
  // config never changes and the outlet keeps its view: the part follows the message's status.
  const clientRef = useAssistantClientRef();
  const isRunning = () => clientRef.parent.message.getState().status?.type === 'running';
  const [running, setRunning] = useState(isRunning);
  // Equal props do not re-render a resource when its parent changes, so follow the parent.
  useEffect(() => {
    setRunning(isRunning());
    return clientRef.parent.subscribe(() => setRunning(isRunning()));
  }, [clientRef.parent]);
  const state = running ? RUNNING : COMPLETE;
  return {
    getState: () => state,
    addToolResult: unsupported,
    resumeToolCall: unsupported,
    respondToToolApproval: unsupported,
    unstable_recordInteraction: async () => unsupported(),
  };
});

/**
 * The scope config for the empty text part of a message with no parts (`s.part`): `{ type:
 * 'text', text: '', status: running | complete }` after the enclosing message's status. One
 * config for the message's whole life, so its outlet keeps its view when the run ends. Primitives
 * such as `aui-part-text` and `*auiPartInProgress` then work for a message with no parts. Render it
 * with `AuiScopeOutletComponent` inside the message scope.
 */
export const emptyMessagePartScopeConfig = (): AuiConfig =>
  AuiConfig({ part: EmptyMessagePartClient() });
