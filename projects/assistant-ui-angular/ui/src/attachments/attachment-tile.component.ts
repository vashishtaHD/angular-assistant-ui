// Ported from packages/ui/src/components/react/assistant-ui/elements/attachment.aui.tsx @ 7d74276
// (AttachmentUI, AttachmentThumb, AttachmentRemove and the preview dialog)
// and packages/ui/src/components/react/assistant-ui/elements/attachment-state.ts @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AuiAttachmentNameComponent,
  AuiAttachmentRemoveDirective,
  AuiAttachmentRootDirective,
  injectAui,
  injectAuiState,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import { AuiDialogCloseDirective, AuiDialogService } from '../dialog/dialog';
import { AuiIconComponent } from '../icons/icon.component';
import { injectAttachmentSrc } from './attachment-src';

const TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  document: 'Document',
  file: 'File',
};

/**
 * One styled attachment: a square tile with the image thumbnail (or a file
 * icon), an uploading or error overlay, the name as its tooltip and, in the
 * composer, a remove button. An image tile is a button (click, Enter or
 * Space) that opens the image in a modal preview dialog; Escape closes it and
 * focus returns to the tile. Other tiles are a focusable group. Render it
 * inside an attachment scope; the styled attachment lists do.
 *
 * State hooks: `data-source` (`composer` or `message`), `data-type`,
 * `data-status`, `data-uploading` and `data-error` on the root;
 * `data-previewable` on the tile.
 */
@Component({
  selector: 'aui-attachment-tile',
  standalone: true,
  imports: [
    AuiAttachmentRootDirective,
    AuiAttachmentRemoveDirective,
    AuiAttachmentNameComponent,
    AuiButtonDirective,
    AuiDialogCloseDirective,
    AuiIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-attachment-tile-host' },
  template: `
    <div
      auiAttachmentRoot
      data-slot="aui_attachment-root"
      class="aui-attachment-root"
      [attr.data-source]="isComposer() ? 'composer' : 'message'"
      [attr.data-uploading]="uploading() ? '' : null"
      [attr.data-error]="errorMessage() !== undefined ? '' : null"
    >
      <div
        data-slot="aui_attachment-tile"
        class="aui-attachment-tile"
        tabindex="0"
        [attr.role]="src() ? 'button' : 'group'"
        [attr.aria-label]="ariaLabel()"
        [attr.title]="title()"
        [attr.data-previewable]="src() ? '' : null"
        (click)="openPreview()"
        (keydown)="onKeydown($event)"
      >
        @if (src(); as src) {
          <img class="aui-attachment-tile-image" alt="" [src]="src" />
        } @else {
          <aui-icon class="aui-attachment-tile-fallback" name="file" />
        }
        @if (uploading()) {
          <div class="aui-attachment-tile-overlay" data-kind="uploading" aria-hidden="true">
            <aui-icon class="aui-attachment-tile-spinner" name="loader" />
          </div>
        }
        @if (errorMessage() !== undefined) {
          <div class="aui-attachment-tile-overlay" data-kind="error" aria-hidden="true">
            <aui-icon class="aui-attachment-tile-error-icon" name="alert-circle" />
          </div>
        }
      </div>
      @if (!isImage() || !isComposer()) {
        <span class="aui-attachment-name"><aui-attachment-name /></span>
      }
      @if (isComposer()) {
        <button
          auiButton
          auiAttachmentRemove
          variant="ghost"
          size="icon"
          class="aui-attachment-remove"
          [attr.aria-label]="'Remove ' + name()"
          [attr.title]="'Remove ' + name()"
        >
          <aui-icon name="x" />
        </button>
      }
    </div>
    <ng-template #preview>
      <div class="aui-attachment-preview">
        <img
          class="aui-attachment-preview-image"
          [src]="src()"
          [alt]="'Preview of ' + name()"
          [attr.data-loaded]="previewLoaded() ? '' : null"
          (load)="previewLoaded.set(true)"
        />
        <button
          auiButton
          auiDialogClose
          variant="ghost"
          size="icon"
          class="aui-attachment-preview-close"
          aria-label="Close preview"
        >
          <aui-icon name="x" />
        </button>
      </div>
    </ng-template>
  `,
})
export class AuiAttachmentTileComponent {
  private readonly aui = injectAui();
  private readonly dialog = inject(AuiDialogService);
  private readonly previewTemplate = viewChild.required<TemplateRef<unknown>>('preview');

  /** @internal */
  protected readonly src = injectAttachmentSrc();
  /** @internal */
  protected readonly name = injectAuiState((s) => s.attachment.name);
  /** @internal */
  protected readonly isImage = injectAuiState((s) => s.attachment.type === 'image');
  private readonly source = injectAuiState(() => this.aui.attachment.source);
  /** @internal */
  protected readonly isComposer = computed(() => this.source() !== 'message');
  private readonly typeLabel = injectAuiState(
    (s) => TYPE_LABELS[s.attachment.type] ?? s.attachment.type,
  );
  // An attachment on a submission is still being prepared, whether or not the
  // adapter reports progress while it uploads.
  /** @internal */
  protected readonly uploading = injectAuiState((s) => {
    const status = s.attachment.status.type;
    if (status === 'incomplete') return false;
    return (
      status === 'running' ||
      (s.optional.message?.submission !== undefined && status !== 'complete')
    );
  });
  /** @internal */
  protected readonly errorMessage = injectAuiState((s) =>
    s.attachment.status.type === 'incomplete' && s.attachment.status.reason === 'error'
      ? (s.attachment.status.message ?? 'Upload failed')
      : undefined,
  );

  /** @internal */
  protected readonly ariaLabel = computed(() => {
    const base = this.src()
      ? `Preview ${this.name()}`
      : `${this.typeLabel()} attachment ${this.name()}`;
    const suffix =
      this.errorMessage() !== undefined ? ', upload failed' : this.uploading() ? ', uploading' : '';
    return `${base}${suffix}`;
  });
  /** @internal */
  protected readonly title = computed(() => {
    const error = this.errorMessage();
    return error === undefined ? this.name() : `${this.name()}: ${error}`;
  });
  /** @internal */
  protected readonly previewLoaded = signal(false);

  /** @internal */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!this.src()) return;
    event.preventDefault();
    this.openPreview();
  }

  /** @internal */
  protected openPreview(): void {
    if (!this.src()) return;
    this.previewLoaded.set(false);
    this.dialog.open(this.previewTemplate(), {
      ariaLabel: `Preview ${this.name()}`,
      panelClass: 'aui-attachment-preview-panel',
    });
  }
}
