// Ported from packages/ui/src/hooks/use-attachment-src.ts @ 7d74276
import { DestroyRef, assertInInjectionContext, computed, inject, type Signal } from '@angular/core';
import { injectAuiState } from 'angular-assistant-ui';

/**
 * Returns a signal of the preview source of the current image attachment: an
 * object URL for a pending attachment's file (created on first read, revoked
 * when the file changes and when the injection context is destroyed), else
 * the first image content part of a completed attachment. `undefined` for an
 * attachment that is not an image or has no image yet. Must be called in an
 * injection context inside an attachment scope.
 *
 * @example
 * ```ts
 * readonly src = injectAttachmentSrc();
 * // template: @if (src(); as src) { <img [src]="src" alt="" /> }
 * ```
 */
export function injectAttachmentSrc(): Signal<string | undefined> {
  assertInInjectionContext(injectAttachmentSrc);
  const file = injectAuiState((s) =>
    s.attachment.type === 'image' && s.attachment.file instanceof File
      ? s.attachment.file
      : undefined,
  );
  const image = injectAuiState((s) => {
    if (s.attachment.type !== 'image') return undefined;
    const part = s.attachment.content?.find((content) => content.type === 'image');
    return part?.type === 'image' && part.image ? part.image : undefined;
  });

  let lastFile: File | undefined;
  let lastUrl: string | undefined;
  const release = () => {
    if (lastUrl !== undefined) URL.revokeObjectURL(lastUrl);
    lastFile = undefined;
    lastUrl = undefined;
  };
  inject(DestroyRef).onDestroy(release);

  return computed(() => {
    const current = file();
    if (current === undefined) {
      release();
      return image();
    }
    if (current !== lastFile) {
      release();
      if (typeof URL.createObjectURL !== 'function') return image();
      lastFile = current;
      lastUrl = URL.createObjectURL(current);
    }
    return lastUrl ?? image();
  });
}
