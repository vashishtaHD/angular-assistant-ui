import { describe, expect, it } from 'vitest';
import { createScriptedAttachmentAdapter, scriptedFile } from './scripted-attachments';

/** Collects every state `add` yields (or the one it resolves). */
async function addAll(
  adapter: ReturnType<typeof createScriptedAttachmentAdapter>,
  file: File,
): Promise<unknown[]> {
  const result = adapter.add({ file });
  if (Symbol.asyncIterator in result) {
    const states: unknown[] = [];
    for await (const state of result) states.push(state);
    return states;
  }
  return [await result];
}

describe('scriptedFile', () => {
  it('builds a File with the name, content and type', async () => {
    const file = scriptedFile('notes.txt', 'hello');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('notes.txt');
    expect(file.type).toBe('text/plain');
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    });
    expect(text).toBe('hello');
  });

  it('infers common types from the extension and takes an explicit one', () => {
    expect(scriptedFile('a.png', 'x').type).toBe('image/png');
    expect(scriptedFile('a.pdf', 'x').type).toBe('application/pdf');
    expect(scriptedFile('a.bin', 'x').type).toBe('application/octet-stream');
    expect(scriptedFile('a.dat', 'x', 'text/csv').type).toBe('text/csv');
  });
});

describe('createScriptedAttachmentAdapter', () => {
  it('accepts everything by default and the given accept string otherwise', () => {
    expect(createScriptedAttachmentAdapter().accept).toBe('*');
    expect(createScriptedAttachmentAdapter({ accept: 'image/*' }).accept).toBe('image/*');
  });

  it('adds a pending attachment with deterministic ids and records the file', async () => {
    const adapter = createScriptedAttachmentAdapter();
    const file = scriptedFile('notes.txt', 'hello');
    const [pending] = await addAll(adapter, file);
    expect(pending).toEqual({
      id: 'attachment-1',
      type: 'document',
      name: 'notes.txt',
      contentType: 'text/plain',
      file,
      status: { type: 'requires-action', reason: 'composer-send' },
    });
    const [second] = await addAll(adapter, scriptedFile('b.png', 'x'));
    expect(second).toMatchObject({ id: 'attachment-2', type: 'image' });
    expect(adapter.added).toEqual([file, expect.any(File)]);
  });

  it('yields upload progress before the pending state when uploadSteps is set', async () => {
    const adapter = createScriptedAttachmentAdapter({ uploadSteps: 2 });
    const states = await addAll(adapter, scriptedFile('a.txt', 'x'));
    expect(states.map((state) => (state as { status: unknown }).status)).toEqual([
      { type: 'running', reason: 'uploading', progress: 0 },
      { type: 'running', reason: 'uploading', progress: 0.5 },
      { type: 'requires-action', reason: 'composer-send' },
    ]);
    expect(new Set(states.map((state) => (state as { id: string }).id)).size).toBe(1);
  });

  it('rejects a file when reject returns a reason', async () => {
    const adapter = createScriptedAttachmentAdapter({
      reject: (file) => (file.size > 3 ? 'too large' : undefined),
    });
    await expect(addAll(adapter, scriptedFile('big.txt', 'abcdef'))).rejects.toThrow('too large');
    await expect(addAll(adapter, scriptedFile('ok.txt', 'ab'))).resolves.toHaveLength(1);
    expect(adapter.added.map((file) => file.name)).toEqual(['ok.txt']);
  });

  it('completes images as an image part and everything else as a file part', async () => {
    const adapter = createScriptedAttachmentAdapter();
    const send = async (file: File) => {
      const [pending] = await addAll(adapter, file);
      return adapter.send(pending as never);
    };

    // A file part keeps the attachment an attachment through the AI SDK runtime's round trip.
    expect(await send(scriptedFile('notes.txt', 'hello'))).toMatchObject({
      status: { type: 'complete' },
      content: [{ type: 'file', data: 'aGVsbG8=', mimeType: 'text/plain', filename: 'notes.txt' }],
    });
    expect(await send(scriptedFile('dot.png', 'png'))).toMatchObject({
      content: [{ type: 'image', image: 'data:image/png;base64,cG5n', filename: 'dot.png' }],
    });
    expect(await send(scriptedFile('doc.pdf', 'pdf'))).toMatchObject({
      content: [{ type: 'file', data: 'cGRm', mimeType: 'application/pdf', filename: 'doc.pdf' }],
    });
    expect(adapter.sent.map((attachment) => attachment.name)).toEqual([
      'notes.txt',
      'dot.png',
      'doc.pdf',
    ]);
  });

  it('inlines text files as a text part with inlineText', async () => {
    const adapter = createScriptedAttachmentAdapter({ inlineText: true });
    const [pending] = await addAll(adapter, scriptedFile('notes.txt', 'hello'));
    expect(await adapter.send(pending as never)).toMatchObject({
      content: [{ type: 'text', text: '<attachment name="notes.txt">\nhello\n</attachment>' }],
    });
    const [image] = await addAll(adapter, scriptedFile('dot.png', 'png'));
    expect(await adapter.send(image as never)).toMatchObject({ content: [{ type: 'image' }] });
  });

  it('fails a send when failSend returns a reason and records removals', async () => {
    const adapter = createScriptedAttachmentAdapter({
      failSend: (attachment) => (attachment.name === 'bad.txt' ? 'upload failed' : undefined),
    });
    const [pending] = await addAll(adapter, scriptedFile('bad.txt', 'x'));
    await expect(adapter.send(pending as never)).rejects.toThrow('upload failed');
    await adapter.remove(pending as never);
    expect(adapter.removed).toEqual([pending]);
  });
});
