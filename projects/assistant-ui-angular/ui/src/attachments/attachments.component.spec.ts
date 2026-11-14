// Ported from packages/ui/src/components/react/assistant-ui/elements/attachment.aui.test.tsx @ 7d74276
// (plus the dialog Escape/focus-return path and the message and add-attachment variants)
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type ThreadMessageLike,
} from '@assistant-ui/core';
import { AssistantRuntimeImpl, ExternalStoreRuntimeCore } from '@assistant-ui/core/internal';
import { RuntimeAdapter } from '@assistant-ui/core/store';
import { AuiConfig } from '@assistant-ui/store/client';
import {
  AuiMessageTemplateDirective,
  AuiProviderDirective,
  AuiThreadMessagesComponent,
  injectAui,
} from 'angular-assistant-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../src/testing-internal/test-bed';
import { overlayRoot, settle as settleOverlay, stubLayout } from '../test-helpers';
import {
  AuiComposerAddAttachmentStyledComponent,
  AuiComposerAttachmentsStyledComponent,
  AuiMessageAttachmentsStyledComponent,
} from './attachments.component';

let config: AuiConfig;

@Component({
  selector: 'aui-test-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class ProbeComponent {
  readonly aui = injectAui();
}

let probe: ProbeComponent | undefined;

@Component({
  standalone: true,
  imports: [
    AuiProviderDirective,
    ProbeComponent,
    AuiComposerAttachmentsStyledComponent,
    AuiComposerAddAttachmentStyledComponent,
    AuiThreadMessagesComponent,
    AuiMessageTemplateDirective,
    AuiMessageAttachmentsStyledComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-test-probe #p />
      {{ capture(p) }}
      <aui-thread-messages>
        <ng-template auiMessage><aui-message-attachments-styled /></ng-template>
      </aui-thread-messages>
      <aui-composer-attachments-styled />
      <aui-composer-add-attachment-styled />
    </div>
  `,
})
class HostComponent {
  readonly config = config;
  capture(p: ProbeComponent) {
    probe = p;
    return '';
  }
}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
    await Promise.resolve();
  }
};

const waitFor = async (fixture: ComponentFixture<unknown>, assertion: () => void) => {
  await vi.waitFor(async () => {
    await settle(fixture);
    assertion();
  });
};

async function mount(messages: ThreadMessageLike[] = []) {
  const core = new ExternalStoreRuntimeCore({
    messages,
    convertMessage: (message: ThreadMessageLike) => message,
    isRunning: false,
    onNew: async () => undefined,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    },
  });
  config = AuiConfig({ threads: RuntimeAdapter(new AssistantRuntimeImpl(core)) });
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const addFile = async (fixture: ComponentFixture<unknown>, file: File) => {
  await probe!.aui.composer.addAttachment(file);
  await settle(fixture);
};

let restoreLayout: () => void;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  restoreLayout = stubLayout();
  let id = 0;
  createObjectURL = vi.fn(() => `blob:attachment-${id++}`);
  revokeObjectURL = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL = createObjectURL;
      static override revokeObjectURL = revokeObjectURL;
    },
  );
});

afterEach(() => {
  restoreLayout();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  probe = undefined;
});

const tile = (el: HTMLElement, name: string) =>
  el.querySelector(
    `[data-slot="aui_attachment-tile"][aria-label^="${name}"]`,
  ) as HTMLElement | null;

describe('aui-composer-attachments-styled', () => {
  it('creates one preview URL and names the preview and remove actions', async () => {
    const { fixture, el } = await mount();
    await addFile(fixture, new File(['image'], 'screenshot.png', { type: 'image/png' }));
    await waitFor(fixture, () => expect(tile(el, 'Preview screenshot.png')).not.toBeNull());
    const preview = tile(el, 'Preview screenshot.png')!;
    expect(preview.getAttribute('role')).toBe('button');
    expect(preview.getAttribute('tabindex')).toBe('0');
    expect(preview.hasAttribute('data-previewable')).toBe(true);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect((preview.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe(
      'blob:attachment-0',
    );
    expect(el.querySelector('button[aria-label="Remove screenshot.png"]')).not.toBeNull();
    fixture.destroy();
  });

  it('opens the preview dialog on click and Escape closes it, returning focus', async () => {
    const { fixture, el } = await mount();
    await addFile(fixture, new File(['image'], 'screenshot.png', { type: 'image/png' }));
    await waitFor(fixture, () => expect(tile(el, 'Preview screenshot.png')).not.toBeNull());
    const preview = tile(el, 'Preview screenshot.png')!;
    preview.focus();
    preview.click();
    await settle(fixture);
    await settleOverlay();
    const dialog = overlayRoot().querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('Preview screenshot.png');
    const image = dialog.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('alt')).toBe('Preview of screenshot.png');
    expect(image.getAttribute('src')).toBe('blob:attachment-0');
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    await settle(fixture);
    await settleOverlay();
    expect(overlayRoot().querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(preview);
    fixture.destroy();
  });

  it.each(['Enter', ' '])('opens the preview with %j', async (key) => {
    const { fixture, el } = await mount();
    await addFile(fixture, new File(['image'], 'screenshot.png', { type: 'image/png' }));
    await waitFor(fixture, () => expect(tile(el, 'Preview screenshot.png')).not.toBeNull());
    const preview = tile(el, 'Preview screenshot.png')!;
    preview.focus();
    preview.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await settle(fixture);
    await settleOverlay();
    expect(overlayRoot().querySelector('[role="dialog"]')).not.toBeNull();
    fixture.destroy();
  });

  it('keeps a file without a preview out of the button interaction model', async () => {
    const { fixture, el } = await mount();
    await addFile(fixture, new File(['report'], 'report.txt', { type: 'text/plain' }));
    await waitFor(fixture, () => expect(tile(el, 'Document attachment report.txt')).not.toBeNull());
    const group = tile(el, 'Document attachment report.txt')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.hasAttribute('data-previewable')).toBe(false);
    group.click();
    await settle(fixture);
    await settleOverlay();
    expect(overlayRoot().querySelector('[role="dialog"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Remove report.txt"]')).not.toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('removes the attachment through its remove button', async () => {
    const { fixture, el } = await mount();
    await addFile(fixture, new File(['report'], 'report.txt', { type: 'text/plain' }));
    await waitFor(fixture, () =>
      expect(el.querySelector('button[aria-label="Remove report.txt"]')).not.toBeNull(),
    );
    (el.querySelector('button[aria-label="Remove report.txt"]') as HTMLButtonElement).click();
    await waitFor(fixture, () =>
      expect(el.querySelector('[data-slot="aui_attachment-tile"]')).toBeNull(),
    );
    fixture.destroy();
  });
});

describe('aui-composer-add-attachment-styled', () => {
  it('renders a labelled add button', async () => {
    const { fixture, el } = await mount();
    const button = el.querySelector(
      'aui-composer-add-attachment-styled button',
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Add Attachment');
    expect(button.querySelector('aui-icon')).not.toBeNull();
    fixture.destroy();
  });
});

describe('aui-message-attachments-styled', () => {
  it('renders a user message attachment without a remove button', async () => {
    const { fixture, el } = await mount([
      {
        id: 'u1',
        role: 'user',
        content: [{ type: 'text', text: 'see file' }],
        attachments: [
          {
            id: 'att-1',
            type: 'document',
            name: 'notes.txt',
            contentType: 'text/plain',
            status: { type: 'complete' },
            content: [{ type: 'text', text: 'hello' }],
          },
        ],
      },
    ]);
    await waitFor(fixture, () =>
      expect(
        el.querySelector('aui-message-attachments-styled [data-slot="aui_attachment-tile"]'),
      ).not.toBeNull(),
    );
    const root = el.querySelector('aui-message-attachments-styled') as HTMLElement;
    expect(root.textContent).toContain('notes.txt');
    expect(root.querySelector('button[aria-label^="Remove"]')).toBeNull();
    fixture.destroy();
  });
});
