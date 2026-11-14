import type { UIMessage, UIMessageChunk } from 'ai';
import { describe, expect, it } from 'vitest';
import { createScriptedChatTransport } from './scripted-chat-transport';

const send = (
  transport: ReturnType<typeof createScriptedChatTransport>,
  messages: UIMessage[] = [],
  abortSignal?: AbortSignal,
) =>
  transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'chat-1',
    messageId: undefined,
    messages,
    abortSignal,
  });

const readAll = async (stream: ReadableStream<UIMessageChunk>) => {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
};

const textTurn = (text: string): UIMessageChunk[] => [
  { type: 'start' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish' },
];

describe('createScriptedChatTransport', () => {
  it('plays scripted turns in order, one per send', async () => {
    const transport = createScriptedChatTransport([
      { chunks: textTurn('one') },
      { chunks: textTurn('two') },
    ]);

    expect(await readAll(await send(transport))).toEqual(textTurn('one'));
    expect(await readAll(await send(transport))).toEqual(textTurn('two'));
  });

  it('rejects when the script is exhausted', async () => {
    const transport = createScriptedChatTransport([]);
    await expect(send(transport)).rejects.toThrow(/no scripted turn left/);
  });

  it('rejects with the scripted error', async () => {
    const error = new Error('network');
    const transport = createScriptedChatTransport([{ error }]);
    await expect(send(transport)).rejects.toBe(error);
  });

  it('builds each turn from the messages when given a function', async () => {
    const seen: UIMessage[][] = [];
    const transport = createScriptedChatTransport((messages) => {
      seen.push(messages);
      return { chunks: textTurn(`echo ${messages.length}`) };
    });
    const messages: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    ];

    expect(await readAll(await send(transport, messages))).toEqual(textTurn('echo 1'));
    expect(seen).toEqual([messages]);
  });

  it('delays each chunk by delayMs', async () => {
    const transport = createScriptedChatTransport([{ chunks: textTurn('slow'), delayMs: 20 }]);
    const started = Date.now();
    expect(await readAll(await send(transport))).toEqual(textTurn('slow'));
    // Five chunks, each delayed; allow for timer granularity.
    expect(Date.now() - started).toBeGreaterThanOrEqual(80);
  });

  it('errors the stream with an AbortError when the request is aborted', async () => {
    const transport = createScriptedChatTransport([{ chunks: textTurn('stop'), delayMs: 1000 }]);
    const controller = new AbortController();
    const stream = await send(transport, [], controller.signal);
    const reading = readAll(stream);
    controller.abort();
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects an already aborted request', async () => {
    const transport = createScriptedChatTransport([{ chunks: textTurn('never') }]);
    const controller = new AbortController();
    controller.abort();
    await expect(send(transport, [], controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('has no stream to reconnect to', async () => {
    const transport = createScriptedChatTransport([]);
    await expect(transport.reconnectToStream({ chatId: 'chat-1' })).resolves.toBeNull();
  });
});
