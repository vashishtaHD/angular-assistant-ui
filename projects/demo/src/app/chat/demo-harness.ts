// Original spec helpers for the demo (no code copied): mounts a page against the mock Mastra server.
import type { Provider, Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { UIMessageChunk } from 'ai';
import {
  createMockMastraServer,
  type MockMastraReply,
  type MockMastraServer,
  type MockMastraServerOptions,
} from 'angular-assistant-ui/testing';
import { vi } from 'vitest';
import { RUNTIME_CONFIG } from '../runtime-config';
import { provideDemo } from './provide-demo';

export const AGENT = 'chatAgent';

/** A text reply streamed word by word. */
export const textReply = (text: string, delayMs?: number): MockMastraReply => ({
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
  ...(delayMs !== undefined && { delayMs }),
});

let servers = 0;

/** A mounted demo page and the mock server it talks to. */
export interface DemoHarness<T> {
  fixture: ComponentFixture<T>;
  server: MockMastraServer;
  root: HTMLElement;
  waitFor(assertion: () => void, timeout?: number): Promise<void>;
  /** Types into the thread composer and clicks Send. */
  send(text: string): Promise<void>;
  /** The chat requests the server received. */
  chatRequests(): MockMastraServer['requests'];
  /** Buttons under `scope` whose trimmed text is `text`. */
  button(text: string, scope?: ParentNode): HTMLButtonElement | undefined;
  destroy(): void;
}

/**
 * Mounts `component` with the demo providers, against a fresh mock Mastra server installed as
 * `globalThis.fetch` (a fresh base URL keeps the transport's stored-id registry isolated).
 */
export async function mountDemo<T>(
  component: Type<T>,
  options: MockMastraServerOptions & {
    seed?: (server: MockMastraServer) => void;
    providers?: Provider[];
  } = {},
): Promise<DemoHarness<T>> {
  const { seed, providers = [], ...serverOptions } = options;
  const server = createMockMastraServer({
    baseUrl: `http://demo-${++servers}.test`,
    ...serverOptions,
  });
  seed?.(server);
  const restoreFetch = server.install();
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideDemo(),
      provideRouter([]),
      { provide: RUNTIME_CONFIG, useValue: { mastraUrl: server.baseUrl, agentId: AGENT } },
      ...providers,
    ],
  });
  const fixture = TestBed.createComponent(component);
  fixture.autoDetectChanges(true);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;

  const waitFor = (assertion: () => void, timeout = 4000) =>
    vi.waitFor(
      async () => {
        fixture.detectChanges();
        await fixture.whenStable();
        assertion();
      },
      { timeout, interval: 10 },
    );

  const send = async (text: string) => {
    let input: HTMLTextAreaElement | null = null;
    await waitFor(() => {
      input = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message input"]');
      if (!input) throw new Error('no composer');
    });
    input!.value = text;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    let sendButton: HTMLButtonElement | null = null;
    await waitFor(() => {
      sendButton = root.querySelector<HTMLButtonElement>('button[aria-label="Send message"]');
      if (!sendButton || sendButton.disabled) throw new Error('send not ready');
    });
    sendButton!.click();
  };

  return {
    fixture,
    server,
    root,
    waitFor,
    send,
    chatRequests: () =>
      server.requests.filter((r) => r.method === 'POST' && r.path === `/chat/${AGENT}`),
    button: (text, scope = root) =>
      Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.trim() === text),
    destroy: () => {
      fixture.destroy();
      restoreFetch();
    },
  };
}
