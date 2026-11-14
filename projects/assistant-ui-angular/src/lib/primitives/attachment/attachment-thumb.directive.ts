// Ported from packages/react/src/primitives/attachment/AttachmentThumb.tsx @ 7d74276
// (upstream renders an extension label; this is the image preview a styled chip needs)
import { DestroyRef, Directive, computed, inject } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/**
 * An `<img>` preview of the current attachment. A pending attachment's image
 * file is shown through an object URL, revoked when the file changes and when
 * the element is destroyed. A completed attachment shows its first image
 * content part. Without an image, `src` is removed.
 */
@Directive({
  selector: 'img[auiAttachmentThumb]',
  standalone: true,
  host: { '[attr.src]': 'src()' },
})
export class AuiAttachmentThumbDirective {
  private readonly attachment = injectAuiState((s) => s.attachment);
  private lastFile: File | undefined;
  private lastUrl: string | undefined;

  /** @internal */
  protected readonly src = computed<string | null>(() => {
    const attachment = this.attachment();
    const file = 'file' in attachment ? attachment.file : undefined;
    if (file instanceof File && file.type.startsWith('image/')) {
      return this.objectUrlFor(file);
    }
    this.release();
    const image = attachment.content?.find((part) => part.type === 'image');
    return image?.type === 'image' ? image.image : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private objectUrlFor(file: File): string | null {
    if (file === this.lastFile) return this.lastUrl ?? null;
    this.release();
    if (typeof URL.createObjectURL !== 'function') return null;
    this.lastFile = file;
    this.lastUrl = URL.createObjectURL(file);
    return this.lastUrl;
  }

  private release(): void {
    if (this.lastUrl !== undefined) URL.revokeObjectURL(this.lastUrl);
    this.lastFile = undefined;
    this.lastUrl = undefined;
  }
}
