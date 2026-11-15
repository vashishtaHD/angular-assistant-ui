// Regression: sending a message with an attachment through the AI SDK runtime
// with a remote thread list (MastraThreads) made a message scope's
// `getClient()`, called from an `injectAuiState` computed, synchronize the
// store and notify subscribers, whose signal writes Angular rejects inside a
// computed (NG0600). Runs in the zone and zoneless projects.
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { UIMessageChunk } from 'ai';
import { AuiConfig, AuiProviderDirective } from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import { MastraThreads } from '../../../mastra/src/mastra-threads';
import { mastraThreadListAdapter } from '../../../mastra/src/thread-list-adapter';
import { createMastraTransport } from '../../../mastra/src/transport';
import { createMockMastraServer } from '../../../testing/src/mock-mastra-server';
import { AuiThreadComponent } from './thread.component';

const reply = (text: string): UIMessageChunk[] => [
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
  { type: 'finish', finishReason: 'stop' },
];

let servers = 0;
let server = createMockMastraServer();

@Component({
  standalone: true,
  imports: [AuiProviderDirective, AuiThreadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [auiProvider]="config"><aui-thread /></div>`,
})
class HostComponent {
  private readonly api = server.baseUrl;
  readonly config = AuiConfig({
    threads: MastraThreads({
      adapter: mastraThreadListAdapter({
        baseUrl: this.api,
        agentId: 'chatAgent',
        fetch: server.fetch,
      }),
      transport: () =>
        createMastraTransport({ api: this.api, agentId: 'chatAgent', fetch: server.fetch }),
    }),
  });
}

let fixture: ComponentFixture<HostComponent> | undefined;
let consoleError: MockInstance<typeof console.error>;
let consoleWarn: MockInstance<typeof console.warn>;

const waitFor = (assertion: () => void) =>
  vi.waitFor(
    async () => {
      fixture!.detectChanges();
      await fixture!.whenStable();
      assertion();
    },
    { timeout: 8000, interval: 10 },
  );

const loggedErrors = () =>
  consoleError.mock.calls.map((args) => args.map((a) => String(a)).join(' '));

/**
 * The one console error the store may log on this path: its notification manager reporting
 * the transient `useClientLookup` key miss it labels recoverable: the in-transit submission row's
 * outgoing scope re-resolves in a store notification after its last-valid cache expired and
 * before change detection rebinds the row. Keeping that cache alive silences it, but in zoneless
 * apps the throw is what makes the store re-resolve the row against its new config (without it
 * a later Edit acts on the stale submission composer), so it is kept.
 */
const RECOVERABLE_LOOKUP =
  /^NotificationManager: subscriber callback error Error: useClientLookup: key "[^"]+" not found \(ignore if recovered\)$/;

describe('aui-thread: sending with an attachment over the AI SDK runtime (MastraThreads)', () => {
  beforeEach(() => {
    server = createMockMastraServer({
      baseUrl: `http://attach-${++servers}.test`,
      respond: (turn) => {
        const last = turn.body.messages.at(-1);
        const text = (last?.parts ?? [])
          .map((part) => (part.type === 'text' ? part.text : ''))
          .join('');
        return { chunks: reply(text === 'what is this?' ? 'Nice picture.' : `Edited: ${text}`) };
      },
    });
    consoleError = vi.spyOn(console, 'error');
    consoleWarn = vi.spyOn(console, 'warn');
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    vi.restoreAllMocks();
  });

  it('sends, shows the attachment in the user message and logs no NG0600', async () => {
    configureTestBed({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const file = new File(['png'], 'photo.png', { type: 'image/png' });
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, 'files', { value: [file] });
      this.onchange?.(new Event('change'));
    });
    root.querySelector<HTMLButtonElement>('button[aria-label="Add Attachment"]')!.click();
    await waitFor(() =>
      expect(root.querySelector('button[aria-label="Remove photo.png"]')).not.toBeNull(),
    );

    const input = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message input"]')!;
    input.value = 'what is this?';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    let send: HTMLButtonElement | null = null;
    await waitFor(() => {
      send = root.querySelector<HTMLButtonElement>('button[aria-label="Send message"]');
      expect(send?.disabled).toBe(false);
    });
    send!.click();

    // The sent message shows its attachment at once, from the in-flight submission.
    const tile = () =>
      root.querySelector<HTMLElement>(
        'aui-message-attachments-styled [data-slot="aui_attachment-tile"]',
      );
    await waitFor(() => expect(tile()).not.toBeNull());
    const firstTile = tile()!;

    await waitFor(() => expect(root.textContent).toContain('Nice picture.'));
    expect(tile()?.getAttribute('aria-label')).toContain('photo.png');
    // The acknowledgement replaces the attachment id, but the row (DOM and scope) survives
    // and shows the acknowledged attachment.
    expect(tile()).toBe(firstTile);
    expect(firstTile.isConnected).toBe(true);
    expect(consoleWarn.mock.calls.map((args) => String(args[0]))).not.toContainEqual(
      expect.stringContaining('NG0956'),
    );
    expect(root.querySelector('button[aria-label="Remove photo.png"]')).toBeNull();
    // The thread shows the final state: both messages, an empty composer.
    expect(root.querySelectorAll('[data-role="user"]')).toHaveLength(1);
    expect(
      root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message input"]')!.value,
    ).toBe('');
    expect(loggedErrors().filter((e) => e.includes('NG0600'))).toEqual([]);
    // The attachment travels inline, the only file form the reference server accepts.
    const sent = server.requests.find((r) => r.method === 'POST' && r.path.startsWith('/chat/'))!
      .body as { messages: { parts: Record<string, unknown>[] }[] };
    expect(sent.messages.at(-1)!.parts.find((p) => p['type'] === 'file')).toMatchObject({
      url: expect.stringMatching(/^data:image\/png;base64,/),
      mediaType: 'image/png',
    });

    // The message scope recovered: edit the attachment-bearing message and send again.
    const edit = root.querySelector<HTMLButtonElement>(
      '[data-role="user"] button[aria-label="Edit"]',
    );
    expect(edit).not.toBeNull();
    edit!.click();
    let editor: HTMLTextAreaElement | null = null;
    await waitFor(() => {
      editor = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Edit message"]');
      expect(editor?.value).toBe('what is this?');
    });
    editor!.value = 'and now?';
    editor!.dispatchEvent(new Event('input', { bubbles: true }));
    const update = () =>
      Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Update');
    await waitFor(() => expect(update()?.disabled).toBe(false));
    update()!.click();

    await waitFor(() => expect(root.textContent).toContain('Edited: and now?'));
    expect(root.querySelector('textarea[aria-label="Edit message"]')).toBeNull();
    expect(
      server.requests.filter((r) => r.method === 'POST' && r.path.startsWith('/chat/')),
    ).toHaveLength(2);
    // The edit keeps the attachment on the new branch.
    expect(
      root
        .querySelector('aui-message-attachments-styled [data-slot="aui_attachment-tile"]')
        ?.getAttribute('aria-label'),
    ).toContain('photo.png');

    // At most the one recoverable lookup miss; nothing else, and no NG0600.
    const errors = loggedErrors();
    expect(errors.filter((e) => !RECOVERABLE_LOOKUP.test(e))).toEqual([]);
    expect(errors.length).toBeLessThanOrEqual(1);
  }, 30000);
});
