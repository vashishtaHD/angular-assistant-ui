// Ported from packages/ai-sdk/src/runtime/useDynamicChatTransport.ts @ 7d74276
// Copyright (c) 2026 AgentbaseAI Inc. MIT License (see NOTICE).
//
// Modified: `UIMessage` is imported from `ai`; React hooks come from
// `@assistant-ui/tap/react-shim` (as in the published package build).
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the ambient types must reach the ng-packagr build, which only compiles files reachable from the entry
/// <reference path="./tap-react-shim.d.ts" />
import type { ChatTransport, UIMessage } from 'ai';
import { useEffect, useInsertionEffect, useState } from '@assistant-ui/tap/react-shim';
import { DynamicChatTransport } from './DynamicChatTransport';

export const useDynamicChatTransport = <UI_MESSAGE extends UIMessage>(
  transport: ChatTransport<UI_MESSAGE>,
  enabled = true,
): ChatTransport<UI_MESSAGE> => {
  const [dynamicTransport] = useState(() =>
    transport instanceof DynamicChatTransport ? transport : new DynamicChatTransport(transport),
  );

  useInsertionEffect(() => {
    if (!enabled || dynamicTransport === transport) return;
    dynamicTransport.setTransport(transport);
  }, [dynamicTransport, enabled, transport]);
  useEffect(() => {
    if (!enabled || dynamicTransport === transport) return;
    dynamicTransport.flushTransportChange();
  }, [dynamicTransport, enabled, transport]);

  return enabled ? dynamicTransport : transport;
};
