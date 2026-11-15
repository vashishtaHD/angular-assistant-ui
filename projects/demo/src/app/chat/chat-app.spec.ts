import type { UIMessage } from 'ai';
import type { MockMastraReply } from 'angular-assistant-ui/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ChatAppComponent } from './chat-app.component';
import { mountDemo, textReply, type DemoHarness } from './demo-harness';
import { DEMO_SUGGESTIONS } from './demo-aui-config';

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

const weatherReply = (delayMs?: number): MockMastraReply => ({
  chunks: [
    { type: 'start-step' },
    {
      type: 'tool-input-available',
      toolCallId: 'call-w',
      toolName: 'getWeather',
      input: { city: 'Paris' },
      providerExecuted: true,
    },
    {
      type: 'tool-output-available',
      toolCallId: 'call-w',
      output: { city: 'Paris', temperatureC: 18, condition: 'Sunny' },
      providerExecuted: true,
    },
    { type: 'finish-step' },
    ...textReply('It is sunny in Paris.').chunks,
  ],
  ...(delayMs !== undefined && { delayMs }),
});

let app: DemoHarness<ChatAppComponent> | undefined;
let consoleError: MockInstance<typeof console.error>;

const html = () => document.documentElement;

describe('ChatAppComponent (the full chat app)', () => {
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error');
    html().classList.remove('aui-dark', 'aui-light');
    try {
      localStorage.clear();
    } catch {
      // No storage in this environment.
    }
  });

  afterEach(() => {
    app?.destroy();
    app = undefined;
    consoleError.mockRestore();
    html().classList.remove('aui-dark', 'aui-light');
  });

  it('renders the thread list sidebar and the thread with three starter suggestions', async () => {
    app = await mountDemo(ChatAppComponent, {
      seed: (s) => {
        s.seedThread({ id: 't1', title: 'Trip to Paris', updatedAt: '2026-01-01T00:00:00.000Z' });
        s.seedThread({ id: 't2', title: 'Lunch plans', updatedAt: '2026-01-02T00:00:00.000Z' });
      },
    });
    const { root, waitFor } = app;

    expect(root.querySelector('aui-thread-list-sidebar')).not.toBeNull();
    expect(root.querySelector('aui-thread-list-sidebar aui-thread')).not.toBeNull();
    await waitFor(() => {
      const titles = Array.from(
        root.querySelectorAll('[data-slot="aui_thread-list-item-title"]'),
        (el) => el.textContent?.trim(),
      );
      expect(titles).toEqual(['Lunch plans', 'Trip to Paris']);
    });
    expect(DEMO_SUGGESTIONS).toHaveLength(3);
    await waitFor(() =>
      expect(root.querySelectorAll('.aui-thread-welcome-suggestion')).toHaveLength(3),
    );
    expect(root.querySelector('.aui-thread-welcome-suggestion')?.textContent).toContain(
      DEMO_SUGGESTIONS[0]!.title,
    );
    // The composer offers attachments (the kit default).
    expect(root.querySelector('button[aria-label="Add Attachment"]')).not.toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('opens a stored thread with its history, then starts a new thread', async () => {
    app = await mountDemo(ChatAppComponent, {
      seed: (s) =>
        s.seedThread({ id: 't1', title: 'Old chat', updatedAt: '2026-01-01T00:00:00.000Z' }, [
          user('u1', 'hello from before'),
          assistant('a1', 'an earlier reply'),
        ]),
    });
    const { root, waitFor, send, server, button } = app;

    let item: HTMLElement | null = null;
    await waitFor(() => {
      item = root.querySelector<HTMLElement>('[data-slot="aui_thread-list-item-trigger"]');
      expect(item).not.toBeNull();
    });
    item!.click();
    await waitFor(() =>
      expect(root.querySelector('aui-thread')?.textContent).toContain('an earlier reply'),
    );

    root.querySelector<HTMLElement>('[data-slot="aui_thread-list-new"]')!.click();
    await waitFor(() => {
      const thread = root.querySelector('aui-thread')!;
      expect(thread.textContent).not.toContain('an earlier reply');
      expect(thread.querySelectorAll('.aui-thread-welcome-suggestion')).toHaveLength(3);
    });

    await send('a fresh start');
    await waitFor(() =>
      expect(root.querySelector('aui-thread')?.textContent).toContain('Echo: a fresh start'),
    );
    await waitFor(() => expect(server.threads()).toHaveLength(2));
    expect(button('New Thread')).toBeDefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('sends a starter suggestion', async () => {
    app = await mountDemo(ChatAppComponent);
    const { root, waitFor, chatRequests } = app;

    await waitFor(() =>
      expect(root.querySelectorAll('.aui-thread-welcome-suggestion')).toHaveLength(3),
    );
    root.querySelector<HTMLButtonElement>('.aui-thread-welcome-suggestion')!.click();

    await waitFor(() => expect(chatRequests()).toHaveLength(1));
    await waitFor(() =>
      expect(root.querySelector('aui-thread')?.textContent).toContain(
        `Echo: ${DEMO_SUGGESTIONS[0]!.prompt}`,
      ),
    );
  });

  it('renders markdown with a highlighted code block', async () => {
    app = await mountDemo(ChatAppComponent, {
      respond: () => ({
        chunks: [
          { type: 'start-step' },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'Here is **bold** code:\n\n' },
          { type: 'text-delta', id: 't1', delta: '```ts\nconst answer = 42;\n```\n' },
          { type: 'text-end', id: 't1' },
          { type: 'finish-step' },
          { type: 'finish', finishReason: 'stop' },
        ],
      }),
    });
    const { root, waitFor, send } = app;

    await send('show me code');

    await waitFor(() => {
      const thread = root.querySelector('aui-thread')!;
      expect(thread.querySelector('strong')?.textContent).toBe('bold');
      const highlighted = thread.querySelector('pre.shiki');
      expect(highlighted).not.toBeNull();
      expect(highlighted!.textContent).toContain('const answer = 42;');
    }, 8000);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('shows the WeatherCard for a getWeather result and the kit tool state while it runs', async () => {
    app = await mountDemo(ChatAppComponent, { respond: () => weatherReply(150) });
    const { root, waitFor, send } = app;

    await send('Weather in Paris?');

    await waitFor(() => {
      const running = root.querySelector(
        '[data-slot="aui_tool-fallback-root"][data-status="running"]',
      );
      expect(running?.textContent).toContain('getWeather');
      expect(root.querySelector('[data-testid="weather-card"]')).toBeNull();
    });
    await waitFor(() => {
      const card = root.querySelector('[data-testid="weather-card"]');
      expect(card?.textContent).toContain('Paris');
      expect(card?.textContent).toContain('18');
      expect(card?.textContent).toContain('Sunny');
    }, 6000);
    await waitFor(() => expect(root.textContent).toContain('It is sunny in Paris.'), 6000);
    expect(root.textContent).not.toContain('Checking the weather');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('approves a bookMeeting call from the approval card and resubmits', async () => {
    app = await mountDemo(ChatAppComponent, {
      respond: (turn) =>
        turn.isResubmit
          ? {
              chunks: [
                {
                  type: 'tool-output-available',
                  toolCallId: 'call-b',
                  output: { confirmed: true, title: 'Sync', when: 'Monday' },
                },
                { type: 'finish-step' },
                ...textReply('Booked your sync.').chunks,
              ],
            }
          : {
              chunks: [
                { type: 'start-step' },
                {
                  type: 'tool-input-available',
                  toolCallId: 'call-b',
                  toolName: 'bookMeeting',
                  input: { title: 'Sync', when: 'Monday' },
                },
                {
                  type: 'tool-approval-request',
                  approvalId: 'run-1::call-b',
                  toolCallId: 'call-b',
                },
              ],
            },
    });
    const { root, waitFor, send, button, chatRequests } = app;

    await send('Book a sync on Monday');

    await waitFor(() => expect(button('Approve')).toBeDefined());
    expect(button('Deny')).toBeDefined();
    button('Approve')!.click();

    await waitFor(() => expect(chatRequests()).toHaveLength(2));
    const body = chatRequests()[1]!.body as { messages: UIMessage[] };
    expect(body.messages[0]!.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-bookMeeting',
          approval: expect.objectContaining({ approved: true }),
        }),
      ]),
    );
    await waitFor(() => expect(root.textContent).toContain('Booked your sync.'));
    await waitFor(() =>
      expect(
        root.querySelector('[data-slot="aui_tool-fallback-approval-receipt"]')?.textContent,
      ).toContain('Approved'),
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('answers an askUser call from the form and resubmits', async () => {
    app = await mountDemo(ChatAppComponent, {
      respond: (turn) =>
        turn.isResubmit
          ? textReply('Blue it is.')
          : {
              chunks: [
                { type: 'start-step' },
                {
                  type: 'tool-input-available',
                  toolCallId: 'call-q',
                  toolName: 'askUser',
                  input: { question: 'Favourite colour?', options: ['Blue', 'Red'] },
                },
                { type: 'finish-step' },
                { type: 'finish', finishReason: 'tool-calls' },
              ],
            },
    });
    const { root, waitFor, send, button, chatRequests } = app;

    await send('Ask me something');

    let form: HTMLElement | null = null;
    await waitFor(() => {
      form = root.querySelector<HTMLElement>('[data-slot="aui_tool-fallback-ask-user"]');
      expect(form?.textContent).toContain('Favourite colour?');
    });
    form!.querySelector<HTMLInputElement>('input[value="Blue"]')!.click();
    await waitFor(() => expect(button('Submit', form!)?.disabled).toBe(false));
    button('Submit', form!)!.click();

    await waitFor(() => expect(chatRequests()).toHaveLength(2));
    const body = chatRequests()[1]!.body as { messages: UIMessage[] };
    expect(body.messages[0]!.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'tool-askUser', state: 'output-available' }),
      ]),
    );
    await waitFor(() => expect(root.textContent).toContain('Blue it is.'));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('sends an image attachment from the composer', async () => {
    app = await mountDemo(ChatAppComponent);
    const { root, waitFor, send, chatRequests } = app;
    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, 'files', { value: [file] });
      this.onchange?.(new Event('change'));
    });
    try {
      root.querySelector<HTMLButtonElement>('button[aria-label="Add Attachment"]')!.click();
      await waitFor(() =>
        expect(root.querySelector('button[aria-label="Remove photo.png"]')).not.toBeNull(),
      );
    } finally {
      click.mockRestore();
    }

    await send('what is in this picture?');

    await waitFor(() => expect(chatRequests()).toHaveLength(1));
    const body = chatRequests()[0]!.body as { messages: UIMessage[] };
    expect(body.messages[0]!.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'file', mediaType: 'image/png' }),
        expect.objectContaining({ type: 'text', text: 'what is in this picture?' }),
      ]),
    );
    await waitFor(() => expect(root.textContent).toContain('Echo: what is in this picture?'));
    // The sent user message shows the attachment; the composer no longer does.
    const messageTile = root.querySelector(
      'aui-message-attachments-styled [data-slot="aui_attachment-tile"]',
    );
    expect(messageTile?.getAttribute('aria-label')).toContain('photo.png');
    expect(root.querySelector('button[aria-label="Remove photo.png"]')).toBeNull();
    const errors = consoleError.mock.calls.map((args) => args.map(String).join(' '));
    expect(errors.filter((e) => e.includes('NG0600'))).toEqual([]);
    // Only the store's own transient lookup hint, marked "(ignore if recovered)", may remain.
    expect(errors.filter((e) => !e.includes('(ignore if recovered)'))).toEqual([]);
  });

  it('groups consecutive tool calls with the kit tool group', async () => {
    const call = (id: string, city: string) =>
      [
        {
          type: 'tool-input-available',
          toolCallId: id,
          toolName: 'getWeather',
          input: { city },
          providerExecuted: true,
        },
        {
          type: 'tool-output-available',
          toolCallId: id,
          output: { city, temperatureC: 20, condition: 'Clear' },
          providerExecuted: true,
        },
      ] as const;
    app = await mountDemo(ChatAppComponent, {
      respond: () => ({
        chunks: [
          { type: 'start-step' },
          ...call('call-1', 'Paris'),
          ...call('call-2', 'Rome'),
          { type: 'finish-step' },
          ...textReply('Both are clear.').chunks,
        ],
      }),
    });
    const { root, waitFor, send } = app;

    await send('Weather in Paris and Rome?');

    await waitFor(() => expect(root.textContent).toContain('Both are clear.'));
    expect(root.querySelector('[data-slot="aui_tool-group-trigger"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="weather-card"]')).toHaveLength(2);
  });

  it('logs feedback and shows a toast', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      app = await mountDemo(ChatAppComponent);
      const { root, waitFor, send } = app;

      await send('hello');
      await waitFor(() => expect(root.textContent).toContain('Echo: hello'));
      let helpful: HTMLButtonElement | null = null;
      await waitFor(() => {
        helpful = root.querySelector<HTMLButtonElement>('button[aria-label="Helpful"]');
        expect(helpful).not.toBeNull();
      });
      helpful!.click();

      await waitFor(() =>
        expect(info).toHaveBeenCalledWith(
          '[feedback]',
          expect.objectContaining({ type: 'positive' }),
        ),
      );
      await waitFor(() =>
        expect(root.querySelector('[role="status"][data-toast]')?.textContent).toContain(
          'Thanks for the feedback',
        ),
      );
    } finally {
      info.mockRestore();
    }
  });

  it('toggles dark mode with the .aui-dark class', async () => {
    app = await mountDemo(ChatAppComponent);
    const { root, waitFor } = app;
    const toggle = root.querySelector<HTMLButtonElement>('button[aria-label="Dark mode"]')!;
    expect(toggle).not.toBeNull();
    expect(html().classList.contains('aui-dark')).toBe(false);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    await waitFor(() => expect(html().classList.contains('aui-dark')).toBe(true));
    expect(html().classList.contains('aui-light')).toBe(false);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    await waitFor(() => expect(html().classList.contains('aui-dark')).toBe(false));
    expect(html().classList.contains('aui-light')).toBe(true);
  });
});
