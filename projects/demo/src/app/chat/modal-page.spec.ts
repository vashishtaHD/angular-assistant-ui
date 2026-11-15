import type { UIMessageChunk } from 'ai';
import { createScriptedChatTransport } from 'angular-assistant-ui/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CHAT_TRANSPORT } from './chat-transport.token';
import { mountDemo, type DemoHarness } from './demo-harness';
import { ModalPageComponent } from './modal-page.component';

const scriptedText = (text: string): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish' },
];

let page: DemoHarness<ModalPageComponent> | undefined;

afterEach(() => {
  page?.destroy();
  page = undefined;
});

describe('ModalPageComponent (/modal)', () => {
  it('opens the assistant modal and chats through the Mastra transport', async () => {
    page = await mountDemo(ModalPageComponent);
    const { root, waitFor, chatRequests } = page;
    const launcher = () =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Open Assistant"]');

    expect(root.querySelector('aui-assistant-modal')).not.toBeNull();
    await waitFor(() => expect(launcher()).not.toBeNull());
    launcher()!.click();

    await waitFor(() =>
      expect(document.querySelector('textarea[aria-label="Message input"]')).not.toBeNull(),
    );
    // The panel renders in a CDK overlay, outside the page root.
    await sendInDocument('hi modal', waitFor);

    await waitFor(() => expect(chatRequests()).toHaveLength(1));
    await waitFor(() => expect(document.body.textContent).toContain('Echo: hi modal'));
  });

  it('uses CHAT_TRANSPORT when it is provided (scripted transport)', async () => {
    page = await mountDemo(ModalPageComponent, {
      providers: [
        {
          provide: CHAT_TRANSPORT,
          useValue: createScriptedChatTransport([{ chunks: scriptedText('Scripted hello.') }]),
        },
      ],
    });
    const { waitFor, chatRequests } = page;

    document.querySelector<HTMLButtonElement>('button[aria-label="Open Assistant"]')!.click();
    await sendInDocument('hello', waitFor);

    await waitFor(() => expect(document.body.textContent).toContain('Scripted hello.'));
    expect(chatRequests()).toHaveLength(0);
  });
});

async function sendInDocument(text: string, waitFor: DemoHarness<unknown>['waitFor']) {
  let input: HTMLTextAreaElement | null = null;
  await waitFor(() => {
    input = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message input"]');
    expect(input).not.toBeNull();
  });
  input!.value = text;
  input!.dispatchEvent(new Event('input', { bubbles: true }));
  let button: HTMLButtonElement | null = null;
  await waitFor(() => {
    button = document.querySelector<HTMLButtonElement>('button[aria-label="Send message"]');
    expect(button?.disabled).toBe(false);
  });
  button!.click();
}
