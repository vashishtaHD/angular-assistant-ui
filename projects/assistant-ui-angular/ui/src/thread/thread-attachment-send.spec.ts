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

describe('aui-thread: sending with an attachment over the AI SDK runtime (MastraThreads)', () => {
  beforeEach(() => {
    server = createMockMastraServer({
      baseUrl: `http://attach-${++servers}.test`,
      respond: () => ({ chunks: reply('Nice picture.') }),
    });
    consoleError = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    consoleError.mockRestore();
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

    await waitFor(() => expect(root.textContent).toContain('Nice picture.'));
    expect(
      root
        .querySelector('aui-message-attachments-styled [data-slot="aui_attachment-tile"]')
        ?.getAttribute('aria-label'),
    ).toContain('photo.png');
    expect(root.querySelector('button[aria-label="Remove photo.png"]')).toBeNull();
    // The thread shows the final state: both messages, an empty composer.
    expect(root.querySelectorAll('[data-role="user"]')).toHaveLength(1);
    expect(
      root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message input"]')!.value,
    ).toBe('');
    expect(loggedErrors().filter((e) => e.includes('NG0600'))).toEqual([]);
    // The only other output allowed is the store's own transient lookup hint, which it marks
    // "(ignore if recovered)": the message scope recovers on the next notification.
    expect(loggedErrors().filter((e) => !e.includes('(ignore if recovered)'))).toEqual([]);
  }, 20000);
});
