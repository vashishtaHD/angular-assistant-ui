// Ported from packages/ai-sdk/src/runtime/AISDKThreads.ts @ 7d74276
// Copyright (c) 2026 AgentbaseAI Inc. MIT License (see NOTICE).
/* eslint-disable @typescript-eslint/consistent-type-definitions -- vendored upstream code, kept close to the original */
//
// Modified for angular-assistant-ui/mastra:
// - The list is always a `RemoteThreadList` over a caller-supplied `RemoteThreadListAdapter`
//   (`adapter`) instead of the assistant-cloud adapter (`cloud`/`scopeId`); the in-memory branch,
//   the cloud adapter swap/reload effect and the SDK identity are removed.
// - Every thread owns its chat entry (the upstream `cloud` path), so a visited thread stays mounted
//   with `backgroundThreads` and its chat stops when the thread body unmounts.
// - Imports come from public package entries; React hooks come from `@assistant-ui/tap/react-shim`
//   (as in the published package build).
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the ambient types must reach the ng-packagr build, which only compiles files reachable from the entry
/// <reference path="./tap-react-shim.d.ts" />
import { resource, useResource, withKey } from '@assistant-ui/tap';
import { useEffect, useState } from '@assistant-ui/tap/react-shim';
import type { Chat } from '@ai-sdk/react';
import type { ChatTransport, UIMessage } from 'ai';
import type { RemoteThreadListAdapter } from '@assistant-ui/core';
import { RemoteThreadList, inMemoryThreadListTransformScopes } from '@assistant-ui/core/store';
import { ThreadClient } from '@assistant-ui/core/store/internal';
import { MessageRepository } from '@assistant-ui/core/internal';
import {
  attachTransformScopes,
  useAssistantClientRef,
  useAssistantScopeEffect,
} from '@assistant-ui/store/client';
import { useAui } from '@assistant-ui/store';
import { AssistantChatTransport } from '@assistant-ui/ai-sdk';
import {
  createChat,
  splitChatThreadOptions,
  useChatThread,
  type ChatThreadOptions,
} from './useChatThread';

export type RemoteAISDKThreadsOptions<UI_MESSAGE extends UIMessage = UIMessage> = Omit<
  ChatThreadOptions<UI_MESSAGE>,
  'id' | 'transport' | 'messages'
> & {
  /**
   * The transport threads send through. A factory is invoked once per thread so each thread owns
   * its instance. A plain `AssistantChatTransport` instance is cloned per thread; any other
   * transport instance is shared as-is. Defaults to one `AssistantChatTransport` per thread.
   */
  transport?: ChatTransport<UI_MESSAGE> | (() => ChatTransport<UI_MESSAGE>) | undefined;
  /** The backing thread list. Keep the reference stable. */
  adapter: RemoteThreadListAdapter;
  /** Controlled thread id. */
  threadId?: string | undefined;
  /** Called with the settled remote id when the list changes thread. */
  onThreadIdChange?: ((threadId: string | undefined) => void) | undefined;
};

type ThreadChatOptions<UI_MESSAGE extends UIMessage = UIMessage> = Omit<
  RemoteAISDKThreadsOptions<UI_MESSAGE>,
  'adapter' | 'threadId' | 'onThreadIdChange'
>;

type ChatOptionsRef<UI_MESSAGE extends UIMessage> = {
  current: ThreadChatOptions<UI_MESSAGE> | undefined;
};

type ChatEntry<UI_MESSAGE extends UIMessage> = {
  chat: Chat<UI_MESSAGE>;
  transport: ChatTransport<UI_MESSAGE>;
  repository: MessageRepository;
  optionsRef: ChatOptionsRef<UI_MESSAGE>;
};

const createChatEntry = <UI_MESSAGE extends UIMessage>(
  threadId: string,
  options: ThreadChatOptions<UI_MESSAGE> | undefined,
): ChatEntry<UI_MESSAGE> => {
  const optionsRef: ChatOptionsRef<UI_MESSAGE> = { current: options };
  const { chatInit } = splitChatThreadOptions(options as ChatThreadOptions<UI_MESSAGE> | undefined);
  const transport =
    typeof options?.transport === 'function'
      ? options.transport()
      : options?.transport === undefined
        ? new AssistantChatTransport<UI_MESSAGE>()
        : options.transport instanceof AssistantChatTransport
          ? (options.transport.__internal_clone() as ChatTransport<UI_MESSAGE>)
          : options.transport;
  return {
    chat: createChat({ ...chatInit, id: threadId, transport }, optionsRef),
    transport,
    repository: new MessageRepository(),
    optionsRef,
  };
};

const useRemoteAISDKChatThread = <UI_MESSAGE extends UIMessage = UIMessage>({
  threadId,
  options,
}: {
  threadId: string;
  options: ThreadChatOptions<UI_MESSAGE> | undefined;
}) => {
  const [owned] = useState(() => createChatEntry(threadId, options));
  const { chat, transport, repository, optionsRef } = owned;

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    return () => {
      void chat.stop().catch(() => undefined);
    };
  }, [chat]);

  const aui = useAui();
  const runtime = useChatThread({ ...options, transport } as ChatThreadOptions<UI_MESSAGE>, {
    id: threadId,
    isMainThread: true,
    getThreadListItem: () => (aui.threadListItem.source ? aui.threadListItem : undefined),
    chat,
    messageRepositoryInstance: repository,
    stopOnClientDestroy: false,
  });

  const clientRef = useAssistantClientRef();
  useAssistantScopeEffect(
    'modelContext',
    () => runtime.registerModelContextProvider(clientRef.current!.modelContext()),
    [runtime],
  );

  return useResource(ThreadClient({ runtime: runtime.thread }));
};

const RemoteAISDKChatThread = resource(useRemoteAISDKChatThread);

const useRemoteAISDKThreads = <UI_MESSAGE extends UIMessage = UIMessage>(
  options: RemoteAISDKThreadsOptions<UI_MESSAGE>,
) => {
  const { adapter, threadId, onThreadIdChange, ...threadOptions } = options;

  const thread = (id: string) =>
    withKey(id, RemoteAISDKChatThread({ threadId: id, options: threadOptions }));

  return useResource(
    RemoteThreadList({
      adapter,
      backgroundThreads: true,
      thread,
      threadId,
      onThreadIdChange,
    }),
  );
};

/**
 * `AuiConfig` entry that runs one AI SDK chat per thread over a `RemoteThreadList` backed by
 * `adapter`, with `backgroundThreads`: every visited thread stays mounted with its own history, a
 * run continues after a switch and stops on delete, and a freshly created thread titles itself.
 * Model context is registered on every mounted thread.
 */
export const RemoteAISDKThreads = resource(useRemoteAISDKThreads);

attachTransformScopes(useRemoteAISDKThreads, inMemoryThreadListTransformScopes);
