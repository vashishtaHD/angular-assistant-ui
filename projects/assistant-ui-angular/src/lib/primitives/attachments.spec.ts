// Ported from packages/vue/src/primitives/composerAttachments.thread-scope.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// (plus the attachment, add-attachment, dropzone and message-attachments primitives)
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type AttachmentAdapter,
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
import {
  AuiAttachmentTemplateDirective,
  carryAttachmentKeys,
  getAttachmentKeys,
} from './attachment/attachment-list';
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

const defaultAdapter = () =>
  new CompositeAttachmentAdapter([
    new SimpleImageAttachmentAdapter(),
    new SimpleTextAttachmentAdapter(),
  ]);

/**
 * A runtime whose `onNew` records the sent user message, attachments included.
 * The thread starts empty: the first send replaces core's in-transit submission
 * row by the host's message row under a different id.
 */
function createAttachmentRuntime(
  attachmentAdapter: AttachmentAdapter = defaultAdapter(),
  options: { ackAttachmentIds?: boolean } = {},
) {
  let messages: Msg[] = [];
  let isDisabled = false;
  const make = (): ExternalStoreAdapter<Msg> => ({
    messages,
    isRunning: false,
    isDisabled,
    convertMessage: (m) => m as never,
    adapters: { attachments: attachmentAdapter },
    onNew: async (message) => {
      // Keeps the submission in flight for a moment, as a network send would.
      if (options.ackAttachmentIds) await new Promise((resolve) => setTimeout(resolve, 60));
      messages = [
        ...messages,
        {
          id: `m${messages.length}`,
          role: 'user',
          content: message.content as never,
          // Like the AI SDK runtime, the acknowledged message can carry new attachment ids.
          attachments: options.ackAttachmentIds
            ? message.attachments?.map((a) => ({ ...a, id: `acked-${a.id}` }))
            : message.attachments,
        },
      ];
      core.setAdapter(make());
    },
  });
  const core = new ExternalStoreRuntimeCore(make());
  const runtime = new AssistantRuntimeImpl(core);
  return {
    config: AuiConfig({ threads: RuntimeAdapter(runtime) }),
    setDisabled(value: boolean) {
      isDisabled = value;
      core.setAdapter(make());
    },
  };
}

// Config the next mounted host uses instead of the default runtime.
let nextConfig: AuiConfig | undefined;
let nextRuntime: ReturnType<typeof createAttachmentRuntime> | undefined;

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
    <div [auiProvider]="config()">
      <aui-probe />
      <div
        auiComposerAttachmentDropzone
        class="dropzone"
        [disabled]="zoneDisabled()"
        (attachmentError)="dropErrors.push($event)"
      >
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
              <ng-template auiAttachment let-attachment>
                <span class="sent" auiAttachmentRoot [attr.data-id]="attachment.id"
                  ><aui-attachment-name
                /></span>
              </ng-template>
            </aui-message-attachments>
          </div>
        </ng-template>
      </aui-thread-messages>
    </div>
  `,
})
class HostComponent {
  readonly rt = nextRuntime ?? createAttachmentRuntime();
  readonly config = signal(nextConfig ?? this.rt.config);
  readonly zoneDisabled = signal(false);
  /** Errors reported by the Add button / by the dropzone. */
  readonly errors: AuiAttachmentError[] = [];
  readonly dropErrors: AuiAttachmentError[] = [];
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
  nextRuntime = undefined;
  vi.restoreAllMocks();
  document.querySelectorAll('input[type="file"]').forEach((node) => node.remove());
});

describe('carryAttachmentKeys', () => {
  const state = (ids: string[]) => ({ ids, keys: getAttachmentKeys(ids.map((id) => ({ id }))) });

  it('keeps the key of a kept id, also when it moves', () => {
    expect(carryAttachmentKeys(['b', 'a'], state(['a', 'b']), false)).toEqual([
      'attachment:b',
      'attachment:a',
    ]);
  });

  it('hands a replaced id the key at its index only on a handoff', () => {
    expect(carryAttachmentKeys(['x', 'y'], state(['a', 'b']), true)).toEqual([
      'attachment:a',
      'attachment:b',
    ]);
    expect(carryAttachmentKeys(['x', 'y'], state(['a', 'b']), false)).toEqual([
      'attachment:x',
      'attachment:y',
    ]);
  });

  it('never reuses the key of an id that is still in the list, and never repeats a key', () => {
    // `a` moved to index 1: index 0's new id must not take `a`'s key.
    expect(carryAttachmentKeys(['x', 'a'], state(['a', 'b']), true)).toEqual([
      'attachment:x',
      'attachment:a',
    ]);
    const keys = carryAttachmentKeys(['x', 'x'], state(['a', 'b']), true);
    expect(new Set(keys).size).toBe(2);
  });
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

  it('sending the first message into an empty thread keeps the row, rebinds it and moves the attachments', async () => {
    const error = vi.spyOn(console, 'error');
    const t = await setup();
    const probe = t.fixture.debugElement.query(By.directive(ProbeComponent))
      .componentInstance as ProbeComponent;
    pick(t, [textFile('a.txt')]);
    await t.settle();
    t.el.querySelector<HTMLButtonElement>('.send')!.click();
    let row: Element | null = null;
    await vi.waitFor(() => {
      t.fixture.detectChanges();
      row = t.el.querySelector('.row');
      expect(row).not.toBeNull();
    });
    await t.settle();
    await t.settle();
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
    const sent = t.el.querySelectorAll('.row .sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.textContent).toContain('a.txt');
    // The row was updated in place and now reads the host's message.
    expect(t.el.querySelector('.row')).toBe(row);
    expect(row!.getAttribute('data-message-id')).toBe('m0');
    // A later store update must not touch the vanished in-transit id.
    probe.aui.composer.setText('next message');
    await t.settle();
    expect(error.mock.calls).toEqual([]);
    expect(t.el.querySelector('.row')).toBe(row);
    expect(row!.getAttribute('data-message-id')).toBe('m0');
    // The node-identity checks above guard against re-creating the row: the message list tracks by
    // `row.key`, for which Angular never reports NG0956, so a console check would prove nothing.
  });

  it('keeps the attachment rows when the acknowledged message replaces every attachment id', async () => {
    nextRuntime = createAttachmentRuntime(defaultAdapter(), { ackAttachmentIds: true });
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    const t = await setup();
    const probe = t.fixture.debugElement.query(By.directive(ProbeComponent))
      .componentInstance as ProbeComponent;
    pick(t, [textFile('a.txt'), textFile('b.txt')]);
    await t.settle();
    const draftIds = probe.aui
      .composer()
      .getState()
      .attachments.map((a) => a.id);
    expect(draftIds).toHaveLength(2);
    t.el.querySelector<HTMLButtonElement>('.send')!.click();
    let sent: Element[] = [];
    await vi.waitFor(
      () => {
        t.fixture.detectChanges();
        sent = Array.from(t.el.querySelectorAll('.row .sent'));
        expect(sent).toHaveLength(2);
      },
      { interval: 5 },
    );
    // In flight: the submission's attachments.
    expect(sent.map((node) => node.getAttribute('data-id'))).toEqual(draftIds);
    await t.settle();
    await t.settle();
    const after = Array.from(t.el.querySelectorAll('.row .sent'));
    // Same DOM nodes (so the same components and scopes) ...
    expect(after).toHaveLength(2);
    expect(after[0]).toBe(sent[0]);
    expect(after[1]).toBe(sent[1]);
    // ... now showing the acknowledged attachments, in order.
    expect(after.map((node) => node.getAttribute('data-id'))).toEqual(
      draftIds.map((id) => `acked-${id}`),
    );
    expect(after.map((node) => node.textContent)).toEqual(['a.txt', 'b.txt']);
    expect(warn.mock.calls.filter((call) => String(call[0]).includes('NG0956'))).toEqual([]);
    expect(error.mock.calls).toEqual([]);
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

  it('clears the drag latch when the dropzone is disabled, without a new drag event', async () => {
    const t = await setup();
    const zone = t.el.querySelector<HTMLElement>('.dropzone')!;
    zone.dispatchEvent(fileDrag('dragenter'));
    await t.settle();
    expect(zone.getAttribute('data-dragging')).toBe('true');
    t.host.zoneDisabled.set(true);
    await t.settle();
    expect(zone.hasAttribute('data-dragging')).toBe(false);
    zone.dispatchEvent(fileDrag('dragleave'));
    t.host.zoneDisabled.set(false);
    await t.settle();
    expect(zone.hasAttribute('data-dragging')).toBe(false);
  });

  it('clears the drag latch when the thread is disabled, without a new drag event', async () => {
    const t = await setup();
    const zone = t.el.querySelector<HTMLElement>('.dropzone')!;
    zone.dispatchEvent(fileDrag('dragenter'));
    await t.settle();
    expect(zone.getAttribute('data-dragging')).toBe('true');
    t.host.rt.setDisabled(true);
    await t.settle();
    expect(zone.hasAttribute('data-dragging')).toBe(false);
    zone.dispatchEvent(fileDrag('dragleave'));
    t.host.rt.setDisabled(false);
    await t.settle();
    expect(zone.hasAttribute('data-dragging')).toBe(false);
  });
});

/** An adapter whose `slow.txt` waits on `release` and whose `boom.txt` fails before any attachment exists. */
function createGatedAdapter() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const adapter: AttachmentAdapter = {
    accept: 'text/plain',
    async *add({ file }) {
      if (file.name === 'nofile.txt') {
        // An adapter whose attachment does not keep the File.
        yield {
          id: 'att-nofile',
          type: 'document',
          name: file.name,
          contentType: file.type,
          status: { type: 'running', reason: 'uploading', progress: 0 },
        } as never;
        throw new Error('lost file');
      }
      if (file.name.startsWith('net')) {
        yield {
          id: `att-${file.name}`,
          type: 'document',
          name: file.name,
          contentType: file.type,
          file,
          status: { type: 'running', reason: 'uploading', progress: 0 },
        };
        throw new Error('net down');
      }
      if (file.name === 'slow.txt') await gate;
      if (file.name === 'boom.txt') throw new Error('boom');
      yield {
        id: `att-${file.name}`,
        type: 'document',
        name: file.name,
        contentType: file.type,
        file,
        status: { type: 'requires-action', reason: 'composer-send' },
      };
    },
    remove: () => Promise.resolve(),
    async send(attachment) {
      return { ...attachment, status: { type: 'complete' }, content: [] };
    },
  };
  return { adapter, release };
}

describe('attachment error ownership', () => {
  const rejected = () => new File(['x'], 'bad.png', { type: 'image/png' });

  it('reports a rejection only on the control that added it while another upload is in flight', async () => {
    const { adapter, release } = createGatedAdapter();
    nextRuntime = createAttachmentRuntime(adapter);
    const t = await setup();
    pick(t, [new File(['x'], 'slow.txt', { type: 'text/plain' })]);
    t.el.querySelector('.dropzone')!.dispatchEvent(fileDrag('drop', [rejected()]));
    await t.settle();
    expect(t.host.dropErrors.map((e) => e.reason)).toEqual(['not-accepted']);
    expect(t.host.errors).toEqual([]);
    release();
    await t.settle();
    expect(t.host.errors).toEqual([]);
    expect(t.host.dropErrors).toHaveLength(1);
  });

  it('reports an upload that fails before any attachment id exists, on its own control only', async () => {
    const { adapter } = createGatedAdapter();
    nextRuntime = createAttachmentRuntime(adapter);
    const t = await setup();
    pick(t, [new File(['x'], 'boom.txt', { type: 'text/plain' })]);
    await t.settle();
    expect(t.host.errors).toHaveLength(1);
    expect(t.host.errors[0]).toMatchObject({ reason: 'adapter-error', message: 'boom' });
    expect(t.host.dropErrors).toEqual([]);
  });

  it('reports the own id and type of the failing file when an earlier failure had the same message', async () => {
    const { adapter } = createGatedAdapter();
    nextRuntime = createAttachmentRuntime(adapter);
    const t = await setup();
    const probe = t.fixture.debugElement.query(By.directive(ProbeComponent))
      .componentInstance as ProbeComponent;
    await probe.aui.composer
      .addAttachment(new File(['x'], 'net1.txt', { type: 'text/plain' }))
      .catch(() => undefined);
    pick(t, [new File(['y'], 'net2.txt', { type: 'text/plain' })]);
    await t.settle();
    expect(t.host.errors).toHaveLength(1);
    expect(t.host.errors[0]).toMatchObject({
      reason: 'adapter-error',
      message: 'net down',
      attachmentId: 'att-net2.txt',
    });
  });

  it('keeps the attachment id of a failed upload whose attachment does not hold the File', async () => {
    const { adapter } = createGatedAdapter();
    nextRuntime = createAttachmentRuntime(adapter);
    const t = await setup();
    pick(t, [new File(['x'], 'nofile.txt', { type: 'text/plain' })]);
    await t.settle();
    expect(t.host.errors).toHaveLength(1);
    expect(t.host.errors[0]).toMatchObject({ message: 'lost file', attachmentId: 'att-nofile' });
  });

  it('does not attribute a direct composer addition to a control with an upload in flight', async () => {
    const { adapter, release } = createGatedAdapter();
    nextRuntime = createAttachmentRuntime(adapter);
    const t = await setup();
    const probe = t.fixture.debugElement.query(By.directive(ProbeComponent))
      .componentInstance as ProbeComponent;
    pick(t, [new File(['x'], 'slow.txt', { type: 'text/plain' })]);
    await probe.aui.composer.addAttachment(rejected()).catch(() => undefined);
    await t.settle();
    expect(t.host.errors).toEqual([]);
    expect(t.host.dropErrors).toEqual([]);
    release();
    await t.settle();
  });
});

describe('picker scope', () => {
  const openPicker = (t: Setup) => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    t.el.querySelector<HTMLButtonElement>('.add')!.click();
    return document.querySelector<HTMLInputElement>('input[type="file"]')!;
  };
  const choose = (input: HTMLInputElement, name: string) => {
    Object.defineProperty(input, 'files', { configurable: true, value: [textFile(name)] });
    input.dispatchEvent(new Event('change'));
  };
  const probeOf = (t: Setup) =>
    t.fixture.debugElement.query(By.directive(ProbeComponent)).componentInstance as ProbeComponent;

  async function threadListSetup() {
    const list = createTestRuntime().withThreadList();
    nextConfig = list.config;
    const t = await setup();
    const { aui } = probeOf(t);
    const adapter = new SimpleTextAttachmentAdapter();
    const originId = aui.threads.getState().mainThreadId;
    list.runtimeFor(originId).withAttachments(adapter);
    // A thread must exist remotely before the list can switch away from it.
    await aui.threads.item({ id: originId }).initialize();
    await t.settle();
    const switchAway = async () => {
      aui.threads.switchToNewThread();
      await vi.waitFor(() => expect(aui.threads.getState().mainThreadId).not.toBe(originId));
      list.runtimeFor(aui.threads.getState().mainThreadId).withAttachments(adapter);
      await t.settle();
    };
    return { t, aui, originId, switchAway };
  }

  it('drops a selection made for a thread that is no longer current', async () => {
    const { t, aui, switchAway } = await threadListSetup();
    const input = openPicker(t);
    await switchAway();
    choose(input, 'stale.txt');
    await t.settle();
    expect(aui.composer.getState().attachments).toHaveLength(0);
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
  });

  it('drops a selection after switching away and back to the same thread', async () => {
    const { t, aui, originId, switchAway } = await threadListSetup();
    const input = openPicker(t);
    await switchAway();
    aui.threads.switchToThread(originId);
    await vi.waitFor(() => expect(aui.threads.getState().mainThreadId).toBe(originId));
    await t.settle();
    choose(input, 'stale.txt');
    await t.settle();
    expect(aui.composer.getState().attachments).toHaveLength(0);
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
  });

  it('drops a selection after the scoped composer is replaced within the same provider', async () => {
    const t = await setup();
    const input = openPicker(t);
    t.host.config.set(createAttachmentRuntime().config);
    await t.settle();
    choose(input, 'stale.txt');
    await t.settle();
    expect(t.el.querySelectorAll('.chip')).toHaveLength(0);
  });

  it('keeps a selection valid across ordinary draft updates', async () => {
    const t = await setup();
    const input = openPicker(t);
    probeOf(t).aui.composer.setText('typing while the picker is open');
    await t.settle();
    choose(input, 'kept.txt');
    await t.settle();
    expect(t.el.querySelector('.chip')!.textContent).toContain('kept.txt');
  });
});
