// Ported from packages/react/src/primitives/composer/ComposerAddAttachment.ts and
// ComposerAttachmentDropzone.tsx @ 7d74276 (the shared "add files, swallow rejections" part)
import { DestroyRef, inject } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiEvent } from '../../state/inject-aui-event';
import { injectAuiState } from '../../state/inject-aui-state';

/** Why adding an attachment failed, as reported by `composer.attachmentAddError`. */
export interface AuiAttachmentError {
  /** `no-adapter`, `not-accepted` or `adapter-error`. */
  reason: 'no-adapter' | 'not-accepted' | 'adapter-error';
  /** A human-readable message. */
  message: string;
  /** The content type of the rejected file, when known. */
  contentType?: string | undefined;
  /** The id of the attachment that failed after it was created, when any. */
  attachmentId?: string | undefined;
}

/** @internal */
export interface AttachmentAdder {
  /** An opaque token for the thread the composer belongs to right now. */
  token(): unknown;
  /**
   * Adds each file to the composer. When `token` is given and the thread
   * changed since it was taken, nothing is added. Rejections are reported
   * through `onError`, never thrown.
   */
  add(files: Iterable<File>, token?: unknown): void;
}

/**
 * Adds files to the composer and forwards `composer.attachmentAddError` events
 * raised by those additions (and only those) to `onError`. Must be called in an
 * injection context inside a composer scope.
 *
 * @internal
 */
export function injectAttachmentAdder(
  onError: (error: AuiAttachmentError) => void,
): AttachmentAdder {
  const aui = injectAui();
  const threadId = injectAuiState((s) => s.optional.threads?.mainThreadId);
  let inFlight = 0;
  let destroyed = false;
  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
  });

  injectAuiEvent('composer.attachmentAddError', (payload) => {
    if (inFlight === 0) return;
    onError({
      reason: payload.reason,
      message: payload.message,
      contentType: payload.contentType,
      attachmentId: payload.attachmentId,
    });
  });

  return {
    token: () => threadId(),
    add(files, token) {
      if (destroyed) return;
      if (token !== undefined && token !== threadId()) return;
      for (const file of Array.from(files)) {
        inFlight++;
        // The composer emits attachmentAddError before rejecting.
        aui.composer
          .addAttachment(file)
          .catch(() => undefined)
          .finally(() => {
            inFlight--;
          });
      }
    },
  };
}
