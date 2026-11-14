// Ported from packages/react/src/primitives/composer/ComposerAddAttachment.ts and
// ComposerAttachmentDropzone.tsx @ 7d74276 (the shared "add files, swallow rejections" part)
import { DestroyRef, inject } from '@angular/core';
import { getProxiedAssistantState } from '@assistant-ui/store/client';
import { injectAuiContext } from '../../context/aui-context';
import { injectAui } from '../../state/inject-aui';
import { injectAuiEvent } from '../../state/inject-aui-event';

/** Why adding an attachment failed. */
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
  /** An opaque token for the composer scope that is current right now. */
  token(): unknown;
  /**
   * Adds each file to the composer. When `token` is given and the composer
   * scope changed since it was taken, nothing is added. Failures are reported
   * through `onError`, never thrown.
   */
  add(files: Iterable<File>, token?: unknown): void;
}

/**
 * Adds files to the composer and reports each failure to `onError` exactly for
 * the addition that failed, never for another control's or a direct caller's.
 * Must be called in an injection context inside a composer scope.
 *
 * Attribution does not rely on a shared counter or on event timing. Whether a
 * failure belongs to a control is decided by that control's own
 * `addAttachment` promise: a rejection (also one before any attachment id
 * exists) or, for an upload that settles as `incomplete`/`error` without
 * rejecting, the pending attachment that holds this operation's `File`. The
 * composer's `attachmentAddError` event only supplies the `reason` of a
 * rejection; it is matched by message and never forwarded on its own.
 *
 * The token changes whenever the thread (`mainThreadId`) or the scoped
 * composer changes, including A to B to A, and not on ordinary draft updates.
 *
 * @internal
 */
export function injectAttachmentAdder(
  onError: (error: AuiAttachmentError) => void,
): AttachmentAdder {
  const aui = injectAui();
  const { source } = injectAuiContext();
  let destroyed = false;

  // The generation changes when the thread, the provider's client or the
  // composer runtime behind it changes (A to B to A included). Replacing the
  // provider's config keeps the client and the thread id but swaps the runtime
  // (a spec covers it), so the runtime is compared where the composer exposes
  // it; composers that do not (store-level ones) rely on thread and client.
  // Draft updates change none of the three.
  let generation = 0;
  const scopeOf = () => {
    try {
      const client = source.getClient();
      return {
        thread: getProxiedAssistantState(client).optional.threads?.mainThreadId,
        client,
        runtime: client.composer.__internal_getRuntime?.(),
      };
    } catch {
      return { thread: undefined, client: undefined, runtime: undefined };
    }
  };
  let scope = scopeOf();
  const unsubscribe = source.subscribe(() => {
    const next = scopeOf();
    if (
      next.thread !== scope.thread ||
      next.client !== scope.client ||
      next.runtime !== scope.runtime
    ) {
      generation++;
    }
    scope = next;
  });
  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
    unsubscribe();
  });

  const report = (error: AuiAttachmentError) => {
    if (!destroyed) onError(error);
  };

  // Recent composer failure events, so a rejection can learn its `reason`.
  // Each carries a sequence number; an operation only claims events raised
  // after it started.
  let sequence = 0;
  const recent: { seq: number; event: AuiAttachmentError }[] = [];
  injectAuiEvent('composer.attachmentAddError', (payload) => {
    recent.push({
      seq: ++sequence,
      event: {
        reason: payload.reason,
        message: payload.message,
        contentType: payload.contentType,
        attachmentId: payload.attachmentId,
      },
    });
    if (recent.length > 20) recent.shift();
  });
  const claim = (message: string, startedAt: number): AuiAttachmentError | undefined => {
    for (let index = recent.length - 1; index >= 0; index--) {
      const entry = recent[index]!;
      if (entry.seq > startedAt && entry.event.message === message) {
        recent.splice(index, 1);
        return entry.event;
      }
    }
    return undefined;
  };

  const heldBy = (file: File) =>
    aui.composer.getState().attachments.find((a) => 'file' in a && a.file === file);

  const reportRejection = (file: File, error: unknown, startedAt: number) => {
    const message = error instanceof Error ? error.message : String(error);
    // Only the reason comes from the event; the file and its attachment are
    // identified by this operation's own `File`.
    const event = claim(message, startedAt);
    const held = heldBy(file);
    report({
      reason: event?.reason ?? 'adapter-error',
      message,
      contentType: held?.contentType || file.type || undefined,
      attachmentId: held?.id,
    });
  };

  const addOne = (file: File) => {
    const startedAt = sequence;
    aui.composer.addAttachment(file).then(
      () => {
        const held = heldBy(file);
        if (held?.status.type === 'incomplete' && held.status.reason === 'error') {
          report({
            reason: 'adapter-error',
            message: held.status.message ?? 'Attachment upload did not complete successfully.',
            contentType: held.contentType || file.type || undefined,
            attachmentId: held.id,
          });
        }
      },
      (error: unknown) => {
        // The failure event is delivered on a microtask of its own; give it one
        // macrotask to arrive before reporting from the rejection.
        setTimeout(() => reportRejection(file, error, startedAt), 0);
      },
    );
  };

  return {
    token: () => generation,
    add(files, token) {
      if (destroyed) return;
      if (token !== undefined && token !== generation) return;
      for (const file of Array.from(files)) addOne(file);
    },
  };
}
