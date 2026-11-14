// Ported from packages/vue/src/__tests__/fixtures.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { useEffect, useState } from 'react';
import { resource } from '@assistant-ui/tap';
import {
  AuiConfig,
  Derived,
  useAssistantEmit,
  useClientResource,
  type AssistantClient,
  type AssistantState,
} from '@assistant-ui/store/client';

/** Methods of the fixture `message` scope. */
export interface FixtureMessage {
  getState(): { id: string; text: string };
  setText(text: string): void;
  ping(value: string): void;
}

/** Methods of the fixture `thread` scope. */
export interface FixtureThread {
  getState(): { selected: number };
  setSelected(index: number): void;
  message(query: { index: number }): FixtureMessage;
}

/** The fixture scopes as seen through an `AssistantClient`. */
export interface FixtureClient {
  thread: FixtureThread;
  message: FixtureMessage;
}

/** The fixture scopes as seen through `AssistantState`. */
export interface FixtureState {
  thread: { selected: number };
  message: { id: string; text: string };
  optional: Record<string, unknown>;
}

/** Views a client through the fixture scopes. */
export const asFixture = (aui: AssistantClient): FixtureClient => aui as unknown as FixtureClient;

/** Views a state through the fixture scopes. */
export const fixtureState = (state: AssistantState): FixtureState =>
  state as unknown as FixtureState;

/** Builds an `AuiConfig` from fixture elements (bypasses the scope registry). */
export const fixtureConfig = (input: Record<string, unknown>): AuiConfig =>
  AuiConfig(input as never);

/** Resolves after pending microtasks and one macrotask. */
export const flushEvents = () => new Promise((resolve) => setTimeout(resolve));

/** Counters bumped by fixture effects. */
export const trackers = { threadCleanups: 0 };

const useMessageClient = ({ id }: { id: string }) => {
  const emit = useAssistantEmit();
  const [text, setText] = useState('');
  return {
    getState: () => ({ id, text }),
    setText,
    ping: (value: string) => emit('message.pinged' as never, { id, value } as never),
  };
};
/** A message scope with local text state and a `message.pinged` event. */
export const MessageClient = resource(useMessageClient);

const useThreadClient = () => {
  const [selected, setSelected] = useState(0);
  const m0 = useClientResource(MessageClient({ id: 'm0' }));
  const m1 = useClientResource(MessageClient({ id: 'm1' }));
  const messages = [m0, m1];
  useEffect(() => {
    return () => {
      trackers.threadCleanups++;
    };
  }, []);
  return {
    getState: () => ({ selected }),
    setSelected,
    message: ({ index }: { index: number }) => messages[index]!.methods,
  };
};
/** A thread scope owning two message scopes and a selected index. */
export const ThreadClient = resource(useThreadClient);

/** A derived `message` scope following the thread's selected index. */
export const messageDerived = () =>
  Derived({
    source: 'thread',
    query: {},
    get: (aui: FixtureClient) => aui.thread.message({ index: aui.thread.getState().selected }),
  } as never);
