import type {
  Attachment,
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/core';

const TYPES_BY_EXTENSION: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

/**
 * A `File` for tests: `name` with `content`, its type taken from `type` or
 * inferred from the extension (`application/octet-stream` when unknown).
 * Add it with `aui.composer().addAttachment(file)`, or hand it to Playwright's
 * `setInputFiles` in a browser test.
 *
 * @example
 * ```ts
 * await aui.composer().addAttachment(scriptedFile('notes.txt', 'hello'));
 * ```
 */
export function scriptedFile(name: string, content: BlobPart = '', type?: string): File {
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return new File([content], name, {
    type: type ?? TYPES_BY_EXTENSION[extension] ?? 'application/octet-stream',
  });
}

/** Options for {@link createScriptedAttachmentAdapter}. */
export interface ScriptedAttachmentAdapterOptions {
  /** The composer's `accept` string. Default `*`. */
  accept?: string;
  /**
   * Rejects a file in `add` when it returns a reason (the error's message),
   * for example a size limit. The composer reports it as an attachment error.
   */
  reject?: (file: File) => string | Error | undefined;
  /** Fails `send` for an attachment when it returns a reason (a failed upload). */
  failSend?: (attachment: PendingAttachment) => string | Error | undefined;
  /**
   * Yields this many `running` (`uploading`) states, with progress from 0
   * towards 1, before the pending state. Default 0 (no upload states).
   */
  uploadSteps?: number;
  /**
   * Sends text files (`text/*`, JSON, XML) as a text part
   * `<attachment name="...">` with their content, as core's
   * `SimpleTextAttachmentAdapter` does, instead of a file part. Default false:
   * the AI SDK runtime turns a text part into message text, so the sent message
   * would show no attachment tile.
   */
  inlineText?: boolean;
}

/** The adapter {@link createScriptedAttachmentAdapter} returns, with what it saw. */
export interface ScriptedAttachmentAdapter extends AttachmentAdapter {
  /** Files accepted by `add`, in order. */
  readonly added: File[];
  /** Attachments completed by `send`, in order. */
  readonly sent: CompleteAttachment[];
  /** Attachments passed to `remove`, in order. */
  readonly removed: Attachment[];
}

const toError = (reason: string | Error): Error =>
  reason instanceof Error ? reason : new Error(reason);

/** Reads a file with `FileReader` (jsdom's `File` has no `text()` or `arrayBuffer()`). */
const read = <T extends string | ArrayBuffer>(file: File, as: 'text' | 'bytes'): Promise<T> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () => reject(reader.error);
    if (as === 'text') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });

const toBase64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await read<ArrayBuffer>(file, 'bytes'));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const isTextFile = (type: string) =>
  type.startsWith('text/') || type === 'application/json' || type === 'application/xml';

/**
 * An offline `AttachmentAdapter` for tests and demos, installed through a
 * runtime's `adapters.attachments` (for example
 * `AISDKThreads({ transport, adapters: { attachments } })`).
 *
 * `add` gives each file a deterministic id (`attachment-1`, `attachment-2`,
 * ...) and the type `image` (for `image/*`) or `document`, optionally after
 * scripted upload progress, and leaves it pending until the composer sends.
 * `send` completes it: images become an image part with a data URL and
 * everything else a base64 file part (or, with `inlineText`, text files a text
 * part `<attachment name="...">`, as core's simple text adapter does). `reject`
 * and `failSend` script failures; `added`, `sent` and `removed` record calls.
 *
 * @example
 * ```ts
 * const attachments = createScriptedAttachmentAdapter({
 *   reject: (file) => (file.size > 1_000_000 ? 'Files must be under 1 MB' : undefined),
 * });
 * const config = AuiConfig({ threads: AISDKChat({ transport, adapters: { attachments } }) });
 * ```
 */
export function createScriptedAttachmentAdapter(
  options: ScriptedAttachmentAdapterOptions = {},
): ScriptedAttachmentAdapter {
  const added: File[] = [];
  const sent: CompleteAttachment[] = [];
  const removed: Attachment[] = [];
  let nextId = 1;
  const steps = Math.max(0, Math.floor(options.uploadSteps ?? 0));

  const pendingFor = (file: File): PendingAttachment => {
    const reason = options.reject?.(file);
    if (reason !== undefined) throw toError(reason);
    added.push(file);
    return {
      id: `attachment-${nextId++}`,
      type: file.type.startsWith('image/') ? 'image' : 'document',
      name: file.name,
      contentType: file.type,
      file,
      status: { type: 'requires-action', reason: 'composer-send' },
    };
  };

  async function* withProgress(file: File): AsyncGenerator<PendingAttachment, void> {
    const pending = pendingFor(file);
    for (let step = 0; step < steps; step++) {
      yield {
        ...pending,
        status: { type: 'running', reason: 'uploading', progress: step / steps },
      };
    }
    yield pending;
  }

  return {
    accept: options.accept ?? '*',
    added,
    sent,
    removed,
    add: ({ file }) => {
      if (steps > 0) return withProgress(file);
      return (async () => pendingFor(file))();
    },
    remove: async (attachment) => {
      removed.push(attachment);
    },
    send: async (attachment) => {
      const reason = options.failSend?.(attachment);
      if (reason !== undefined) throw toError(reason);
      const { file } = attachment;
      const type = file.type || attachment.contentType || 'application/octet-stream';
      const name = attachment.name.replace(/"/g, '&quot;');
      const content: CompleteAttachment['content'] =
        options.inlineText && isTextFile(type)
          ? [
              {
                type: 'text',
                text: `<attachment name="${name}">\n${await read<string>(file, 'text')}\n</attachment>`,
              },
            ]
          : type.startsWith('image/')
            ? [
                {
                  type: 'image',
                  image: `data:${type};base64,${await toBase64(file)}`,
                  filename: attachment.name,
                },
              ]
            : [
                {
                  type: 'file',
                  data: await toBase64(file),
                  mimeType: type,
                  filename: attachment.name,
                },
              ];
      const complete: CompleteAttachment = { ...attachment, status: { type: 'complete' }, content };
      sent.push(complete);
      return complete;
    },
  };
}
