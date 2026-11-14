import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { createScriptedChatTransport, type ScriptedTurn } from 'angular-assistant-ui/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { CHAT_TRANSPORT } from './chat-transport.token';
import { ChatComponent } from './chat.component';

const textTurn = (...deltas: string[]): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'text-start', id: 't1' },
  ...deltas.map((delta): UIMessageChunk => ({ type: 'text-delta', id: 't1', delta })),
  { type: 'text-end', id: 't1' },
  { type: 'finish' },
];

const weatherTurn = (): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'start-step' },
  {
    type: 'tool-input-available',
    toolCallId: 'call-1',
    toolName: 'getWeather',
    input: { city: 'Paris' },
    providerExecuted: true,
  },
  {
    type: 'tool-output-available',
    toolCallId: 'call-1',
    output: { city: 'Paris', temperatureC: 18, condition: 'Sunny' },
    providerExecuted: true,
  },
  { type: 'finish-step' },
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'It is sunny in Paris.' },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
  { type: 'finish' },
];

/** Wraps a transport to record the abort signal of every send. */
const recordSignals = (transport: ChatTransport<UIMessage>) => {
  const signals: (AbortSignal | undefined)[] = [];
  const recorded: ChatTransport<UIMessage> = {
    sendMessages: (options) => {
      signals.push(options.abortSignal);
      return transport.sendMessages(options);
    },
    reconnectToStream: (options) => transport.reconnectToStream(options),
  };
  return { transport: recorded, signals };
};

let consoleError: MockInstance<typeof console.error>;
let fixture: ComponentFixture<ChatComponent> | undefined;

const mount = async (transport: ChatTransport<UIMessage>) => {
  TestBed.configureTestingModule({
    imports: [ChatComponent],
    providers: [{ provide: CHAT_TRANSPORT, useValue: transport }],
  });
  fixture = TestBed.createComponent(ChatComponent);
  fixture.autoDetectChanges(true);
  await fixture.whenStable();
  return fixture;
};

const mountScript = (script: ScriptedTurn[]) => mount(createScriptedChatTransport(script));

const root = () => fixture!.nativeElement as HTMLElement;
const textarea = () => root().querySelector('textarea') as HTMLTextAreaElement;
const sendButton = () =>
  root().querySelector('button[aria-label="Send"]') as HTMLButtonElement | null;
const stopButton = () =>
  root().querySelector('button[aria-label="Stop"]') as HTMLButtonElement | null;
const bubbles = (role: 'user' | 'assistant') =>
  Array.from(root().querySelectorAll<HTMLElement>(`[data-role="${role}"]`));
const lastAssistant = () => bubbles('assistant').at(-1);

const type = (value: string) => {
  textarea().value = value;
  textarea().dispatchEvent(new Event('input', { bubbles: true }));
  fixture!.detectChanges();
};

const waitFor = (assertion: () => void, timeout = 2000) =>
  vi.waitFor(
    async () => {
      fixture!.detectChanges();
      await fixture!.whenStable();
      assertion();
    },
    { timeout, interval: 10 },
  );

const sendText = async (value: string) => {
  type(value);
  await waitFor(() => expect(sendButton()?.disabled).toBe(false));
  sendButton()!.click();
};

describe('ChatComponent', () => {
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    consoleError.mockRestore();
  });

  it('streams an assistant reply', async () => {
    await mountScript([{ chunks: textTurn('Hi ', 'there!') }]);

    await sendText('hello');

    await waitFor(() =>
      expect(bubbles('user').map((b) => b.textContent?.trim())).toEqual(['hello']),
    );
    await waitFor(() => expect(lastAssistant()?.textContent?.trim()).toMatch(/Hi there!$/));
    await waitFor(() => expect(stopButton()).toBeNull());
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('renders the weather card for a getWeather tool call', async () => {
    await mountScript([{ chunks: weatherTurn() }]);

    await sendText("What's the weather in Paris?");

    await waitFor(() => {
      const card = root().querySelector('[data-testid="weather-card"]');
      expect(card).not.toBeNull();
      expect(card!.textContent).toContain('Paris');
      expect(card!.textContent).toContain('18');
      expect(card!.textContent).toContain('Sunny');
    });
    await waitFor(() => expect(lastAssistant()?.textContent).toContain('It is sunny in Paris.'));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('shows a loading weather card until the tool result arrives', async () => {
    const chunks = weatherTurn();
    await mountScript([{ chunks, delayMs: 150 }]);

    await sendText('Weather in Paris?');

    await waitFor(() => {
      const card = root().querySelector('[data-testid="weather-card"]');
      expect(card?.getAttribute('data-state')).toBe('loading');
      expect(card!.textContent).toContain('Paris');
    });
    await waitFor(() => {
      const card = root().querySelector('[data-testid="weather-card"]');
      expect(card?.getAttribute('data-state')).toBe('done');
      expect(card!.textContent).toContain('18');
    }, 4000);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('shows stop while running and cancels', async () => {
    const { transport, signals } = recordSignals(
      createScriptedChatTransport([
        { chunks: textTurn('first ', 'second ', 'third ', 'fourth ', 'the end'), delayMs: 100 },
      ]),
    );
    await mount(transport);
    expect(stopButton()).toBeNull();

    await sendText('count');

    await waitFor(() => expect(stopButton()).not.toBeNull());
    expect(sendButton()).toBeNull();
    stopButton()!.click();

    await waitFor(() => expect(stopButton()).toBeNull());
    expect(sendButton()).not.toBeNull();
    expect(signals[0]?.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    fixture!.detectChanges();
    expect(root().textContent).not.toContain('the end');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('recovers from transport error', async () => {
    await mountScript([{ error: new Error('network') }, { chunks: textTurn('Back online.') }]);

    await sendText('hello');

    await waitFor(() => expect(lastAssistant()?.textContent).toContain('Something went wrong'));
    await waitFor(() => expect(stopButton()).toBeNull());

    type('try again');
    await waitFor(() => expect(sendButton()?.disabled).toBe(false));
    sendButton()!.click();
    await waitFor(() => expect(lastAssistant()?.textContent).toContain('Back online.'));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('destroy while streaming', async () => {
    const { transport, signals } = recordSignals(
      createScriptedChatTransport([
        { chunks: textTurn('streaming ', 'and ', 'streaming ', 'on'), delayMs: 50 },
      ]),
    );
    await mount(transport);

    await sendText('keep going');
    await waitFor(() => expect(lastAssistant()?.textContent).toContain('streaming'));

    fixture!.destroy();
    fixture = undefined;

    await vi.waitFor(() => expect(signals[0]?.aborted).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(consoleError).not.toHaveBeenCalled();
  });
});
