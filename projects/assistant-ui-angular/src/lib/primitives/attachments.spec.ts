// Ported from packages/vue/src/primitives/composerAttachments.thread-scope.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (plus the attachment, add-attachment, dropzone and message-attachments primitives)
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type ExternalStoreAdapter,
} from '@assistant-ui/core';
import { AssistantRuntimeImpl, ExternalStoreRuntimeCore } from '@assistant-ui/core/internal';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig } from '@assistant-ui/store/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { configureTestBed } from '../../testing-internal/test-bed';
import { createTestRuntime } from '../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../provider/aui-provider.directive';
import { AuiAttachmentNameComponent } from './attachment/attachment-name.component';
import { AuiAttachmentRemoveDirective } from './attachment/attachment-remove.directive';
import { AuiAttachmentRootDirective } from './attachment/attachment-root.directive';
import { AuiAttachmentThumbDirective } from './attachment/attachment-thumb.directive';
import { AuiAttachmentTemplateDirective } from './attachment/attachment-list';
import type { AuiAttachmentError } from './attachment/inject-add-attachments';
import { AuiComposerAddAttachmentDirective } from './composer-add-attachment.directive';
import { AuiComposerAttachmentDropzoneDirective } from './composer-attachment-dropzone.directive';
import { AuiComposerAttachmentsComponent } from './composer-attachments.component';
import { AuiComposerSendDirective } from './composer-send.directive';
import { AuiMessageAttachmentsComponent } from './message-attachments.component';
import { AuiMessageRootDirective } from './message-root.directive';
import {
  AuiMessageTemplateDirective,
  AuiThreadMessagesComponent,
} from './thread-messages.component';
import { injectAui } from '../state/inject-aui';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: never;
  attachments?: unknown;
}

/** A runtime whose `onNew` records the sent user message, attachments included. */
function createAttachmentRuntime() {
  let messages: Msg[] = [];
  const make = (): ExternalStoreAdapter<Msg> => ({
    messages,
    isRunning: false,
    convertMessage: (m) => m as never,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    },
    onNew: async (message) => {
      messages = [
        ...messages,
        {
          id: `m${messages.length}`,
          role: 'user',
          content: message.content as never,
          attachments: message.attachments,
        },
      ];
      core.setAdapter(make());
    },
  });
  const core = new ExternalStoreRuntimeCore(make());
  const runtime = new AssistantRuntimeImpl(core);
  return { config: AuiConfig({ threads: RuntimeAdapter(runtime) }) };
}

// Config the next mounted host uses instead of the default runtime.
let nextConfig: AuiConfig | undefined;

@Component({
  selector: 'aui-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
}

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    ProbeComponent,
    AuiComposerAttachmentsComponent,
    AuiAttachmentTemplateDirective,
    AuiAttachmentRootDirective,
    AuiAttachmentNameComponent,
    AuiAttachmentRemoveDirective,
    AuiAttachmentThumbDirective,
    AuiComposerAddAttachmentDirective,
    AuiComposerAttachmentDropzoneDirective,
    AuiComposerSendDirective,
    AuiMessageAttachmentsComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageRootDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-probe />
      <div auiComposerAttachmentDropzone class="dropzone" (attachmentError)="errors.push($event)">
        <aui-composer-attachments>
          <ng-template auiAttachment>
            <div auiAttachmentRoot class="chip">
              <img auiAttachmentThumb alt="" />
              <span class="name"><aui-attachment-name /></span>
              <button auiAttachmentRemove class="remove">x</button>
            </div>
          </ng-template>
        </aui-composer-attachments>
        <button auiComposerAddAttachment class="add" (attachmentError)="errors.push($event)">
          add
        </button>
      </div>
      <button auiComposerSend class="send">send</button>
      <aui-thread-messages>
        <ng-template auiMessage>
          <div auiMessageRoot class="row">
            <aui-message-attachments>
              <ng-template auiAttachment>
                <span class="sent" auiAttachmentRoot><aui-attachment-name /></span>
              </ng-template>
            </aui-message-attachments>
          </div>
        </ng-template>
      </aui-thread-messages>
    </div>
  `,
})
class HostComponent {
  readonly config = nextConfig ?? createAttachmentRuntime().config;
  readonly errors: AuiAttachmentError[] = [];
}

interface Setup {
  fixture: ComponentFixture<HostComponent>;
  host: HostComponent;
  el: HTMLElement;
  settle(): Promise<void>;
}

async function setup(): Promise<Setup> {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const settle = async () => {
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  return { fixture, host: fixture.componentInstance, el: fixture.nativeElement, settle };
}

/** Clicks Add and feeds `files` to the hidden input it creates. */
function pick(t: Setup, files: File[]): void {
  const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
  t.el.querySelector<HTMLButtonElement>('.add')!.click();
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  expect(input).not.toBeNull();
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change'));
  click.mockRestore();
}

const textFile = (name = 'notes.txt') => new File(['hello'], name, { type: 'text/plain' });

function fileDrag(type: string, files: File[] = []): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files, dropEffect: 'copy' },
  });
  return event;
}

afterEach(() => {
  nextConfig = undefined;
  vi.restoreAllMocks();
  document.querySelectorAll('input[type="file"]').forEach((node) => node.remove());
});

describe('attachment primitives', () => {
  it('adds a File through the hidden input and shows a chip with its name', async () => {
    const t = await setup();
    pick(t, [textFile()]);
    await t.settle();
    const chip = t.el.querySelector('.chip')!;
    expect(chip.textContent).toContain('notes.txt');
    expect(chip.getAttribute('data-type')).toBe('document');
    expect(chip.getAttribute('data-status')).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('opens the picker with the composer accept list and multiple', async () => {
    const t = await setup();
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    t.el.querySelector<HTMLButtonElement>('.add')!.click();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.multiple).toBe(true);
    expect(input.accept).toContain('image/*');
  });

  it('remove deletes the attachment', async () => {
    const t = await setup();
    pick(t, [textFile()]);
    await t.settle();
    t.el.querySelector<HTMLButtonElement>('.remove')!.click();
    await t.settle();
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
  });

  it('sending moves the attachments onto the user message', async () => {
    // Core shows the sent message under a generated id first, then the host's
    // id replaces it; Angular reports the row re-creation (NG0956). Expected here.
    const warn = console.warn;
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (!String(args[0]).includes('NG0956')) warn(...args);
    });
    const t = await setup();
    pick(t, [textFile('a.txt')]);
    await t.settle();
    t.el.querySelector<HTMLButtonElement>('.send')!.click();
    await t.settle();
    await t.settle();
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
    const sent = t.el.querySelectorAll('.row .sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.textContent).toContain('a.txt');
  });

  it('emits attachmentError with the reason for a rejected type', async () => {
    const t = await setup();
    pick(t, [new File(['x'], 'tool.exe', { type: 'application/x-msdownload' })]);
    await t.settle();
    expect(t.host.errors).toHaveLength(1);
    expect(t.host.errors[0]!.reason).toBe('not-accepted');
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
  });

  it('sets data-dragging while a file drag hovers the dropzone and adds dropped files', async () => {
    const t = await setup();
    const zone = t.el.querySelector<HTMLElement>('.dropzone')!;
    const over = fileDrag('dragover');
    zone.dispatchEvent(over);
    await t.settle();
    expect(over.defaultPrevented).toBe(true);
    expect(zone.getAttribute('data-dragging')).toBe('true');
    zone.dispatchEvent(fileDrag('dragleave'));
    await t.settle();
    expect(zone.hasAttribute('data-dragging')).toBe(false);

    zone.dispatchEvent(fileDrag('dragenter'));
    zone.dispatchEvent(fileDrag('drop', [textFile('dropped.txt')]));
    await t.settle();
    expect(zone.hasAttribute('data-dragging')).toBe(false);
    expect(t.el.querySelector('.chip')!.textContent).toContain('dropped.txt');
  });

  it('ignores drags that carry no files', async () => {
    const t = await setup();
    const zone = t.el.querySelector<HTMLElement>('.dropzone')!;
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['text/plain'], files: [] } });
    zone.dispatchEvent(event);
    await t.settle();
    expect(event.defaultPrevented).toBe(false);
    expect(zone.hasAttribute('data-dragging')).toBe(false);
  });

  it('revokes thumb object URLs when the chip is destroyed', async () => {
    const create = vi.fn(() => 'blob:thumb-1');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const t = await setup();
    pick(t, [new File(['png'], 'pic.png', { type: 'image/png' })]);
    await t.settle();
    expect(create).toHaveBeenCalledTimes(1);
    expect(t.el.querySelector('img')!.getAttribute('src')).toBe('blob:thumb-1');
    expect(revoke).not.toHaveBeenCalled();
    t.el.querySelector<HTMLButtonElement>('.remove')!.click();
    await t.settle();
    expect(revoke).toHaveBeenCalledWith('blob:thumb-1');
  });

  it('revokes thumb object URLs when the host is destroyed', async () => {
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: () => 'blob:thumb-2', revokeObjectURL: revoke });
    const t = await setup();
    pick(t, [new File(['png'], 'pic.png', { type: 'image/png' })]);
    await t.settle();
    t.fixture.destroy();
    expect(revoke).toHaveBeenCalledWith('blob:thumb-2');
  });

  it('drops a picker selection made for a thread that is no longer current', async () => {
    const list = createTestRuntime().withThreadList();
    nextConfig = list.config;
    const t = await setup();
    const probe = t.fixture.debugElement.query(By.directive(ProbeComponent))
      .componentInstance as ProbeComponent;
    const adapter = new SimpleTextAttachmentAdapter();
    const originId = probe.aui.threads.getState().mainThreadId;
    list.runtimeFor(originId).withAttachments(adapter);
    // A thread must exist remotely before the list can switch away from it.
    await probe.aui.threads.item({ id: originId }).initialize();
    await t.settle();
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    t.el.querySelector<HTMLButtonElement>('.add')!.click();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    probe.aui.threads.switchToNewThread();
    await vi.waitFor(() => expect(probe.aui.threads.getState().mainThreadId).not.toBe(originId));
    list.runtimeFor(probe.aui.threads.getState().mainThreadId).withAttachments(adapter);
    await t.settle();
    Object.defineProperty(input, 'files', { configurable: true, value: [textFile('stale.txt')] });
    input.dispatchEvent(new Event('change'));
    await t.settle();
    expect(probe.aui.composer.getState().attachments).toHaveLength(0);
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
  });
});
