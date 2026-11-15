// Ported from packages/core/src/react/providers/ReadonlyThreadProvider.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/providers/TextMessagePartProvider.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/core/src/react/providers/ThreadListItemRuntimeProvider.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// and packages/react/src/context/providers/MessageProvider.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import type { ThreadListItemRuntime, ThreadMessage } from '@assistant-ui/core';
import { ThreadRuntimeImpl, type ThreadListItemRuntimeBinding } from '@assistant-ui/core/internal';
import { ReadonlyThreadRuntimeCore } from '@assistant-ui/core/internal';
import {
  ThreadMessageClient,
  type PartState,
  type ThreadMessageClientProps,
} from '@assistant-ui/core/store';
import { ThreadClient, ThreadListItemClient } from '@assistant-ui/core/store/internal';
import { AuiConfig, Derived, type ClientOutput } from '@assistant-ui/store/client';
import { resource } from '@assistant-ui/tap';

/**
 * The scope config that gives a subtree a `threadListItem` from a bare
 * runtime object (React's `ThreadListItemRuntimeProvider`). Use it as
 * `[auiProvider]="threadListItemRuntimeScope(runtime)"` with
 * `[auiProviderExtends]="aui"`.
 */
export function threadListItemRuntimeScope(runtime: ThreadListItemRuntime): AuiConfig {
  return AuiConfig({ threadListItem: ThreadListItemClient({ runtime }) });
}

/**
 * The scope config that gives a subtree a `message` from a plain message
 * object (React's `MessageProvider`), for rendering a message that is not
 * part of a live thread.
 */
export function messageObjectScope(props: ThreadMessageClientProps): AuiConfig {
  return AuiConfig({ message: ThreadMessageClient(props) });
}

const unsupported = (): never => {
  throw new Error('Not supported');
};

const TextMessagePartClient = resource(
  ({ text, isRunning }: { text: string; isRunning: boolean }): ClientOutput<'part'> => {
    const state: PartState = {
      type: 'text',
      text,
      status: isRunning ? { type: 'running' } : { type: 'complete' },
    };
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
 * The scope config that gives a subtree a text `part` from a plain string
 * (React's `TextMessagePartProvider`), so part-level primitives can render
 * text that is not part of a message.
 */
export function textMessagePartScope(text: string, isRunning = false): AuiConfig {
  return AuiConfig({ part: TextMessagePartClient({ text, isRunning }) });
}

const READONLY_THREAD_PATH = Object.freeze({
  ref: 'readonly-thread',
  threadSelector: { type: 'main' as const },
});

// One frozen state object: snapshot reads must return the same reference.
const READONLY_THREAD_LIST_ITEM = Object.freeze({
  id: 'readonly',
  remoteId: undefined,
  externalId: undefined,
  isMain: true,
  isRunning: false,
  status: 'regular' as const,
  title: undefined,
});

const READONLY_THREAD_LIST_ITEM_BINDING: ThreadListItemRuntimeBinding = Object.freeze({
  path: READONLY_THREAD_PATH,
  getState: () => READONLY_THREAD_LIST_ITEM,
  subscribe: () => () => undefined,
});

/** The result of {@link readonlyThreadScope}. */
export interface ReadonlyThreadScope {
  /** The scope config: `thread` over the fixed messages, plus its `composer`. */
  config: AuiConfig;
  /** Replaces the messages the read-only thread shows. */
  setMessages(messages: readonly ThreadMessage[]): void;
}

/**
 * Builds a read-only thread over a fixed list of messages (React's
 * `ReadonlyThreadProvider`), for rendering a transcript with the thread and
 * message primitives. Mount `config` with `[auiProvider]` and
 * `[auiProviderExtends]="aui"`; call `setMessages` to show a different list.
 *
 * @example
 * ```ts
 * protected readonly transcript = readonlyThreadScope(messages);
 * ```
 */
export function readonlyThreadScope(messages: readonly ThreadMessage[]): ReadonlyThreadScope {
  const core = new ReadonlyThreadRuntimeCore();
  core.setMessages(messages);
  const threadRuntime = new ThreadRuntimeImpl(
    {
      path: READONLY_THREAD_PATH,
      getState: () => core,
      subscribe: (callback) => core.subscribe(callback),
      outerSubscribe: (callback) => core.subscribe(callback),
    },
    READONLY_THREAD_LIST_ITEM_BINDING,
  );
  return {
    config: AuiConfig({
      thread: ThreadClient({ runtime: threadRuntime }),
      composer: Derived({
        source: 'thread',
        query: {},
        get: (aui) => aui.thread.composer(),
      }),
    }),
    setMessages: (next) => core.setMessages(next),
  };
}
