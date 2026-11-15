// Original spec (Task 14 M9): MastraThreads on real react and @ai-sdk/react (no upstream test exists).
import { createRequire } from 'node:module';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { UIMessage } from 'ai';
import {
  AuiConfig,
  AuiProviderDirective,
  injectAui,
  type AssistantClient,
} from 'angular-assistant-ui';
import {
  MastraThreads,
  createMastraTransport,
  mastraThreadListAdapter,
} from 'angular-assistant-ui/mastra';
import type { UIMessageChunk } from 'ai';
import {
  createMockMastraServer,
  type MockMastraReply,
  type MockMastraServer,
  type MockMastraServerOptions,
} from 'angular-assistant-ui/testing';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Parked from Task 14 (M9): the library's specs run `MastraThreads` (and the
// `useChat` of `@ai-sdk/react` behind it) through tap's standalone React shim.
// The demo resolves `react` to the real package, so this spec runs the same
// path the browser build ships: real `react` and `@ai-sdk/react`.

const AGENT = 'chatAgent';
const user = (id: string, text: string): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
});
const assistant = (id: string, text: string): UIMessage => ({
  id,
  role: 'assistant',
  parts: [{ type: 'text', text }],
});

@Component({
  selector: 'aui-demo-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
}

let server: MockMastraServer;
let restoreFetch: (() => void) | undefined;
let fixture: ComponentFixture<unknown> | undefined;
let servers = 0;

/** The words of a reply streamed one chunk per `delayMs`. */
const slowReply = (text: string, delayMs: number): MockMastraReply => ({
  chunks: [
    { type: 'start-step' },
    { type: 'text-start', id: 't1' },
    ...text.split(' ').map((word, i): UIMessageChunk => ({
      type: 'text-delta',
      id: 't1',
      delta: i === 0 ? word : ` ${word}`,
    })),
    { type: 'text-end', id: 't1' },
    { type: 'finish-step' },
    { type: 'finish', finishReason: 'stop' },
  ],
  delayMs,
});

/** The abort signal of each chat request, in order. */
let chatSignals: (AbortSignal | undefined)[] = [];

const mount = async (respond?: MockMastraServerOptions['respond']) => {
  server = createMockMastraServer({
    baseUrl: `http://real-react-${++servers}.test`,
    ...(respond && { respond }),
  });
  server.seedThread({ id: 't1', title: 'First', updatedAt: '2026-01-01T00:00:00.000Z' }, [
    user('u1', 'hello one'),
    assistant('a1', 'reply one'),
  ]);
  server.seedThread({ id: 't2', title: 'Second', updatedAt: '2026-01-02T00:00:00.000Z' }, [
    user('u2', 'hello two'),
    assistant('a2', 'reply two'),
  ]);
  const restoreServer = server.install();
  const serverFetch = globalThis.fetch;
  chatSignals = [];
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (init?.method === 'POST' && new URL(url).pathname === `/chat/${AGENT}`) {
      chatSignals.push(init.signal ?? undefined);
    }
    return serverFetch(input, init);
  };
  restoreFetch = () => {
    globalThis.fetch = serverFetch;
    restoreServer();
  };
  const baseUrl = server.baseUrl;

  @Component({
    standalone: true,
    imports: [AuiProviderDirective, ProbeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div [auiProvider]="config"><aui-demo-probe /></div>`,
  })
  class HostComponent {
    readonly config = AuiConfig({
      threads: MastraThreads({
        adapter: mastraThreadListAdapter({ baseUrl, agentId: AGENT }),
        transport: () => createMastraTransport({ api: baseUrl, agentId: AGENT }),
      }),
    });
  }

  TestBed.configureTestingModule({ imports: [HostComponent] });
  fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges(true);
  await fixture.whenStable();
  const { aui } = fixture.debugElement.query(By.directive(ProbeComponent))
    .componentInstance as ProbeComponent;
  await aui.threads().getLoadThreadsPromise();
  return aui;
};

const waitFor = (assertion: () => void) =>
  vi.waitFor(
    async () => {
      fixture!.detectChanges();
      await fixture!.whenStable();
      assertion();
    },
    { timeout: 3000, interval: 10 },
  );

const texts = (aui: AssistantClient) =>
  aui
    .thread()
    .getState()
    .messages.map((m) => m.content.map((p) => (p.type === 'text' ? p.text : '')).join(''));
const ids = (aui: AssistantClient) =>
  aui
    .thread()
    .getState()
    .messages.map((m) => m.id);
const chatBodies = () =>
  server.requests
    .filter((r) => r.method === 'POST' && r.path === `/chat/${AGENT}`)
    .map((r) => r.body as { messages: UIMessage[]; messageIds?: string[] });

describe('MastraThreads on real react and @ai-sdk/react (M9)', () => {
  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    restoreFetch?.();
    restoreFetch = undefined;
  });

  it('resolves the real packages, not the tap shim', () => {
    const require = createRequire(import.meta.url);
    expect(require.resolve('react')).toMatch(/[\\/]node_modules[\\/]react[\\/]index\.js$/);
    expect(require.resolve('@ai-sdk/react')).toMatch(
      /[\\/]node_modules[\\/]@ai-sdk[\\/]react[\\/]/,
    );
    // The shim has no `version`; React 18 and 19 both export one.
    expect(React.version).toMatch(/^(18|19)\./);
  });

  it('loads the history on a thread switch, sends, and flushes the stored ids', async () => {
    const aui = await mount();
    const history = (id: string) =>
      server.requests.filter((r) => r.path === `/chat/${AGENT}/threads/${id}/messages`);

    aui.threads().switchToThread('t1');
    await waitFor(() => expect(texts(aui)).toEqual(['hello one', 'reply one']));
    aui.threads().switchToThread('t2');
    await waitFor(() => expect(texts(aui)).toEqual(['hello two', 'reply two']));
    aui.threads().switchToThread('t1');
    await waitFor(() => expect(texts(aui)).toEqual(['hello one', 'reply one']));
    expect(history('t1')).toHaveLength(1);
    expect(history('t2')).toHaveLength(1);

    aui.thread().composer().setText('first');
    aui.thread().composer().send();
    await waitFor(() => expect(texts(aui).at(-1)).toBe('Echo: first'));
    await waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    // The first send reconciles against the ids the history load stored.
    expect(chatBodies()[0]!.messageIds).toEqual(['u1', 'a1', ids(aui)[2]]);
    expect(chatBodies()[0]!.messages.map((m) => m.id)).toEqual([ids(aui)[2]]);

    aui.thread().composer().setText('second');
    aui.thread().composer().send();
    await waitFor(() => expect(texts(aui).at(-1)).toBe('Echo: second'));
    await waitFor(() => expect(aui.thread().getState().isRunning).toBe(false));

    // The completed first run flushed its ids (including the server's assistant id), so the
    // second send carries only the new user message.
    const second = chatBodies()[1]!;
    expect(second.messageIds).toEqual(ids(aui).slice(0, 5));
    expect(second.messages.map((m) => m.id)).toEqual([ids(aui)[4]]);
    expect(server.messages('t1').map((m) => m.id)).toEqual(ids(aui));
  });

  const startSlowRun = async () => {
    const aui = await mount(() => slowReply('one two three four five six seven eight', 25));
    aui.threads().switchToThread('t1');
    await waitFor(() => expect(texts(aui)).toEqual(['hello one', 'reply one']));
    aui.thread().composer().setText('stream please');
    aui.thread().composer().send();
    await waitFor(() => expect(aui.thread().getState().isRunning).toBe(true));
    expect(chatSignals).toHaveLength(1);
    return aui;
  };

  it('keeps streaming a run in its thread while another thread is shown', async () => {
    const aui = await startSlowRun();
    aui.threads().switchToThread('t2');
    await waitFor(() => expect(texts(aui)).toEqual(['hello two', 'reply two']));

    // The t1 run finishes on the server while t2 is shown; t2 stays as it was.
    await waitFor(() => expect(server.messages('t1')).toHaveLength(4));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(texts(aui)).toEqual(['hello two', 'reply two']);
    expect(aui.thread().getState().isRunning).toBe(false);
    expect(chatSignals[0]!.aborted).toBe(false);

    aui.threads().switchToThread('t1');
    await waitFor(() =>
      expect(texts(aui)).toEqual([
        'hello one',
        'reply one',
        'stream please',
        'one two three four five six seven eight',
      ]),
    );
    expect(aui.thread().getState().isRunning).toBe(false);
  });

  it('aborts the running request when its thread is deleted', async () => {
    const aui = await startSlowRun();
    await aui.threads().item({ id: 't1' }).delete();
    await waitFor(() => expect(chatSignals[0]!.aborted).toBe(true));
  });

  it('aborts the running request when the provider is destroyed', async () => {
    await startSlowRun();
    fixture!.destroy();
    fixture = undefined;
    await vi.waitFor(() => expect(chatSignals[0]!.aborted).toBe(true));
  });
});
