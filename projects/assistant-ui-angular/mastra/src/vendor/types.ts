// Ported from packages/ai-sdk/src/runtime/useAISDKRuntime.ts and
// packages/ai-sdk/src/transport/AssistantChatTransport.ts @ 7d74276
// Copyright (c) 2026 AgentbaseAI Inc. MIT License (see NOTICE).
//
// Modified: these types are not exported by `@assistant-ui/ai-sdk@0.0.18`, so they are
// derived from its public exports instead of deep-imported.
import type { ThreadListItemRuntime } from '@assistant-ui/core';
import type { useAISDKRuntime } from '@assistant-ui/ai-sdk';
import type { UIMessage } from 'ai';

/** The adapter options `useAISDKRuntime` accepts. */
export type AISDKRuntimeAdapter<UI_MESSAGE extends UIMessage = UIMessage> = NonNullable<
  Parameters<typeof useAISDKRuntime<UI_MESSAGE>>[1]
>;

/** Converts an assistant-ui append message into an AI SDK create message. */
export type CustomToCreateMessageFunction = NonNullable<AISDKRuntimeAdapter['toCreateMessage']>;

/** The part of a thread list item a transport needs to resolve the remote thread id. */
export type InitializableThreadListItem = Pick<ThreadListItemRuntime, 'initialize'>;
