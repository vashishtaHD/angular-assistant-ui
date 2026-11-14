// Ported from packages/vue/src/__tests__/primitives-content.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/core';
import { AssistantRuntimeImpl, ExternalStoreRuntimeCore } from '@assistant-ui/core/internal';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig } from '@assistant-ui/store/client';

/** A minimal message accepted by the test runtime's external store adapter. */
export interface DemoMessage {
  /** Stable message id; omit to let the runtime generate one. */
  id?: string;
  role: 'user' | 'assistant';
  content: ThreadMessageLike['content'];
}

/** A real assistant runtime over an in-memory external store, for specs. */
export interface TestRuntime {
  runtime: AssistantRuntimeImpl;
  /** `AuiConfig({ threads: RuntimeAdapter(runtime) })`. */
  config: AuiConfig;
  append(message: DemoMessage): void;
  setRunning(value: boolean): void;
  /** Replaces the whole message list (update in place, remove, reorder). */
  setMessages(next: DemoMessage[]): void;
}

/**
 * Creates an `ExternalStoreRuntimeCore`-backed runtime plus helpers that push
 * new messages, replace the list or toggle `isRunning` by replacing the adapter.
 */
export function createTestRuntime(): TestRuntime {
  let messages: DemoMessage[] = [];
  let isRunning = false;
  const makeAdapter = (): ExternalStoreAdapter<DemoMessage> => ({
    messages,
    isRunning,
    convertMessage: (message) => ({
      ...(message.id === undefined ? {} : { id: message.id }),
      role: message.role,
      content: message.content,
    }),
    onNew: async () => undefined,
  });
  const core = new ExternalStoreRuntimeCore(makeAdapter());
  const runtime = new AssistantRuntimeImpl(core);
  const append = (message: DemoMessage) => {
    messages = [...messages, message];
    core.setAdapter(makeAdapter());
  };
  const setRunning = (value: boolean) => {
    isRunning = value;
    core.setAdapter(makeAdapter());
  };
  const setMessages = (next: DemoMessage[]) => {
    messages = next;
    core.setAdapter(makeAdapter());
  };
  return {
    runtime,
    config: AuiConfig({ threads: RuntimeAdapter(runtime) }),
    append,
    setRunning,
    setMessages,
  };
}
