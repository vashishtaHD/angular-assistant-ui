// Ported from packages/ai-sdk/src/runtime/getResumableAdapter.ts @ 7d74276
// Copyright (c) 2026 AgentbaseAI Inc. MIT License (see NOTICE).
//
// Modified: imports come from the public `@assistant-ui/ai-sdk` and `ai` entries.
import { AssistantChatTransport, type AssistantChatResumableOptions } from '@assistant-ui/ai-sdk';
import type { ChatTransport, UIMessage } from 'ai';

export const getResumableAdapter = <UI_MESSAGE extends UIMessage>(
  transport: ChatTransport<UI_MESSAGE>,
): AssistantChatResumableOptions | undefined => {
  if (transport instanceof AssistantChatTransport) {
    return transport.getResumableAdapter();
  }
  const candidate = (transport as { getResumableAdapter?: () => unknown }).getResumableAdapter;
  if (typeof candidate !== 'function') return undefined;
  return candidate.call(transport) as AssistantChatResumableOptions | undefined;
};
