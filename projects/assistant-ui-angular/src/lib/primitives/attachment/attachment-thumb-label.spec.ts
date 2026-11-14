// Ported from packages/react/src/primitives/attachment/AttachmentThumb.test.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AttachmentAdapter } from '@assistant-ui/core';
import { describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../testing-internal/test-bed';
import { createTestRuntime } from '../../../testing-internal/test-runtime';
import { AuiProviderDirective } from '../../provider/aui-provider.directive';
import { injectAui } from '../../state/inject-aui';
import { AuiComposerAttachmentsComponent } from '../composer-attachments.component';
import { AuiAttachmentTemplateDirective } from './attachment-list';
import {
  AuiAttachmentThumbLabelComponent,
  getAttachmentThumbLabel,
} from './attachment-thumb-label.component';

describe('getAttachmentThumbLabel', () => {
  it('uses the dotted extension for a single-extension name', () => {
    expect(getAttachmentThumbLabel('photo.png', 'file')).toBe('.png');
  });
  it('takes only the last segment for a multi-extension name', () => {
    expect(getAttachmentThumbLabel('archive.tar.gz', 'file')).toBe('.gz');
  });
  it('falls back to the attachment type when the name has no extension', () => {
    expect(getAttachmentThumbLabel('noext', 'document')).toBe('document');
  });
  it('falls back to the attachment type for an empty name', () => {
    expect(getAttachmentThumbLabel('', 'image')).toBe('image');
  });
  it('treats a leading-dot name as extensionless', () => {
    expect(getAttachmentThumbLabel('.gitignore', 'file')).toBe('file');
  });
  it('falls back to the attachment type for a trailing-dot name', () => {
    expect(getAttachmentThumbLabel('report.', 'image')).toBe('image');
  });
});

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
    AuiAttachmentThumbLabelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [auiProvider]="config">
      <aui-probe />
      <aui-composer-attachments>
        <ng-template auiAttachment="document">
          <p class="default"><aui-attachment-thumb-label /></p>
        </ng-template>
        <ng-template auiAttachment="file">
          <p class="override"><aui-attachment-thumb-label>PDF</aui-attachment-thumb-label></p>
        </ng-template>
      </aui-composer-attachments>
    </div>
  `,
})
class HostComponent {
  readonly rt = createTestRuntime();
  readonly config = this.rt.config;
}

const adapter = (type: 'document' | 'file'): AttachmentAdapter => ({
  accept: '*',
  async add({ file }) {
    return {
      id: file.name,
      type,
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
});

async function render(type: 'document' | 'file', name: string): Promise<HTMLElement> {
  configureTestBed({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.rt.withAttachments(adapter(type));
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const probe = fixture.debugElement.children[0]!.children[0]!.componentInstance as ProbeComponent;
  await probe.aui.composer.addAttachment(new File(['x'], name, { type: 'application/pdf' }));
  for (let round = 0; round < 3; round++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    fixture.detectChanges();
    await fixture.whenStable();
  }
  return fixture.nativeElement as HTMLElement;
}

describe('aui-attachment-thumb-label', () => {
  it('renders the extension of the current attachment', async () => {
    const el = await render('document', 'report.pdf');
    expect(el.querySelector('.default')!.textContent!.trim()).toBe('.pdf');
  });

  it('renders the attachment type for an extensionless name', async () => {
    const el = await render('document', 'README');
    expect(el.querySelector('.default')!.textContent!.trim()).toBe('document');
  });

  it('renders projected content instead of the label', async () => {
    const el = await render('file', 'report.pdf');
    expect(el.querySelector('.override')!.textContent!.trim()).toBe('PDF');
  });
});
