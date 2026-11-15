// Ported from packages/core/src/react/runtimes/assistant-transport/replayBoundaryStream.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { AssistantMessageAccumulator, DataStreamDecoder } from 'assistant-stream';
import { describe, expect, it, vi } from 'vitest';
import { REPLAY_CONTENT_LENGTH_HEADER, createReplayBoundaryStream } from './assistant-transport';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const createBody = (chunks: readonly string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

const createResponse = (chunks: readonly string[], replayContentLength?: number | string) =>
  new Response(
    createBody(chunks),
    replayContentLength === undefined
      ? undefined
      : { headers: { [REPLAY_CONTENT_LENGTH_HEADER]: String(replayContentLength) } },
  );

const createRenderWait = () => {
  const pending: (() => void)[] = [];
  const waitForRender = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        pending.push(resolve);
      }),
  );
  const releaseNext = async () => {
    for (let i = 0; pending.length === 0 && i < 10; i++) await Promise.resolve();
    const resolve = pending.shift();
    expect(resolve).toBeDefined();
    resolve!();
    await Promise.resolve();
  };
  return { waitForRender, releaseNext };
};

const readText = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const chunks: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join('');
};

describe('createReplayBoundaryStream', () => {
  it('short-circuits responses without a valid replay content length', async () => {
    const setReplaying = vi.fn();
    const waitForRender = vi.fn();
    for (const replayContentLength of [undefined, 'abc', '3.5', '-1']) {
      setReplaying.mockClear();
      waitForRender.mockClear();
      const body = await createReplayBoundaryStream(createResponse(['live'], replayContentLength), {
        setReplaying,
        waitForRender,
      });
      expect(await readText(body)).toBe('live');
      expect(setReplaying).not.toHaveBeenCalled();
      expect(waitForRender).not.toHaveBeenCalled();
    }
  });

  it('pauses at the replay boundary before releasing live bytes', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    const replayPrefix = '0:"hi"\nb:{"toolCallId":"call-1","toolName":"te';
    const liveSuffix = 'st"}\n';
    const replayContentLength = encoder.encode(replayPrefix).byteLength;

    const streamPromise = createReplayBoundaryStream(
      createResponse([replayPrefix + liveSuffix], replayContentLength),
      { setReplaying, waitForRender },
    );
    expect(setReplaying).toHaveBeenCalledWith(true);
    expect(waitForRender).toHaveBeenCalledTimes(1);

    await releaseNext();
    const reader = (await streamPromise).getReader();
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode(replayPrefix),
    });
    expect(waitForRender).toHaveBeenCalledTimes(2);
    expect(setReplaying).toHaveBeenCalledTimes(1);

    let liveReadResolved = false;
    const liveRead = reader.read().then((read) => {
      liveReadResolved = true;
      return read;
    });
    await Promise.resolve();
    expect(liveReadResolved).toBe(false);

    await releaseNext();
    expect(setReplaying).toHaveBeenLastCalledWith(false);
    expect(waitForRender).toHaveBeenCalledTimes(3);
    await Promise.resolve();
    expect(liveReadResolved).toBe(false);

    await releaseNext();
    await expect(liveRead).resolves.toMatchObject({
      done: false,
      value: encoder.encode(liveSuffix),
    });
  });

  it('pauses when a chunk ends exactly at the replay boundary', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    const replayContentLength = encoder.encode('replay').byteLength;

    const streamPromise = createReplayBoundaryStream(
      createResponse(['replay', 'live'], replayContentLength),
      { setReplaying, waitForRender },
    );
    await releaseNext();
    const reader = (await streamPromise).getReader();
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode('replay'),
    });
    expect(setReplaying).toHaveBeenCalledTimes(1);

    let liveReadResolved = false;
    const liveRead = reader.read().then((read) => {
      liveReadResolved = true;
      return read;
    });
    await Promise.resolve();
    expect(liveReadResolved).toBe(false);

    await releaseNext();
    expect(setReplaying).toHaveBeenLastCalledWith(false);
    await releaseNext();
    await expect(liveRead).resolves.toMatchObject({ done: false, value: encoder.encode('live') });
  });

  it('accumulates replay bytes across chunks before splitting live bytes', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    const replayContentLength = encoder.encode('part1part2').byteLength;

    const streamPromise = createReplayBoundaryStream(
      createResponse(['part1', 'part2live1', 'live2'], replayContentLength),
      { setReplaying, waitForRender },
    );
    await releaseNext();
    const reader = (await streamPromise).getReader();
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode('part1'),
    });
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode('part2'),
    });
    expect(setReplaying).toHaveBeenCalledTimes(1);

    let liveReadResolved = false;
    const liveRead = reader.read().then((read) => {
      liveReadResolved = true;
      return read;
    });
    await Promise.resolve();
    expect(liveReadResolved).toBe(false);

    await releaseNext();
    expect(setReplaying).toHaveBeenLastCalledWith(false);
    await releaseNext();
    await expect(liveRead).resolves.toMatchObject({ done: false, value: encoder.encode('live1') });
    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode('live2'),
    });
  });

  it('clears replaying when the stream ends before the boundary', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    const body = createBody(['hi']);
    const streamPromise = createReplayBoundaryStream(
      new Response(body, {
        headers: { [REPLAY_CONTENT_LENGTH_HEADER]: '10' },
      }),
      {
        setReplaying,
        waitForRender,
      },
    );

    await releaseNext();
    const stream = await streamPromise;
    const text = readText(stream);
    await releaseNext();
    await releaseNext();

    await expect(text).resolves.toBe('hi');
    expect(setReplaying).toHaveBeenLastCalledWith(false);
    expect(body.locked).toBe(false);
  });

  it('leaves replay cleanup to the caller when the first render wait rejects', async () => {
    const setReplaying = vi.fn();
    const error = new Error('aborted');
    const body = createBody(['replay']);

    await expect(
      createReplayBoundaryStream(
        new Response(body, {
          headers: { [REPLAY_CONTENT_LENGTH_HEADER]: '6' },
        }),
        {
          setReplaying, // A thenable keeps zone.js from logging the deliberate rejection.
          waitForRender: () =>
            ({
              then: (_resolve: unknown, reject: (e: unknown) => void) => reject(error),
            }) as Promise<void>,
        },
      ),
    ).rejects.toBe(error);

    expect(setReplaying.mock.calls).toEqual([[true]]);
    expect(body.locked).toBe(false);
  });

  it('clears replaying when the gated stream is cancelled', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('hi'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamPromise = createReplayBoundaryStream(
      new Response(body, { headers: { [REPLAY_CONTENT_LENGTH_HEADER]: '10' } }),
      { setReplaying, waitForRender },
    );

    await releaseNext();
    const stream = await streamPromise;
    await stream.cancel('done');

    expect(setReplaying).toHaveBeenLastCalledWith(false);
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });

  it('releases the response body reader after a read failure', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    const error = new Error('stream failed');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(error);
      },
    });
    const streamPromise = createReplayBoundaryStream(
      new Response(body, { headers: { [REPLAY_CONTENT_LENGTH_HEADER]: '10' } }),
      { setReplaying, waitForRender },
    );

    await releaseNext();
    const stream = await streamPromise;

    await expect(stream.getReader().read()).rejects.toBe(error);
    expect(setReplaying).toHaveBeenLastCalledWith(false);
    expect(body.locked).toBe(false);
  });

  it('does not wait for replay completion after cancellation unblocks a read', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const streamPromise = createReplayBoundaryStream(
      new Response(body, { headers: { [REPLAY_CONTENT_LENGTH_HEADER]: '10' } }),
      { setReplaying, waitForRender },
    );

    await releaseNext();
    const stream = await streamPromise;
    const reader = stream.getReader();
    const read = reader.read();

    await Promise.resolve();
    expect(waitForRender).toHaveBeenCalledTimes(1);

    await reader.cancel('done');
    await expect(read).resolves.toMatchObject({ done: true });

    expect(waitForRender).toHaveBeenCalledTimes(1);
    expect(setReplaying).toHaveBeenLastCalledWith(false);
    expect(cancelled).toBe(true);
  });

  it('does not clear replaying twice when cancelled during replay completion', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    const replayStr = 'replay';
    const replayContentLength = encoder.encode(replayStr).byteLength;

    const streamPromise = createReplayBoundaryStream(
      createResponse([replayStr], replayContentLength),
      { setReplaying, waitForRender },
    );

    await releaseNext();
    const stream = await streamPromise;
    const reader = stream.getReader();

    await expect(reader.read()).resolves.toMatchObject({
      done: false,
      value: encoder.encode(replayStr),
    });
    expect(waitForRender).toHaveBeenCalledTimes(2);

    const cancel = reader.cancel('done');
    await Promise.resolve();
    expect(setReplaying).toHaveBeenCalledTimes(1);

    await releaseNext();
    expect(setReplaying).toHaveBeenCalledTimes(2);
    expect(setReplaying).toHaveBeenLastCalledWith(false);

    await releaseNext();
    await cancel;
    expect(setReplaying).toHaveBeenCalledTimes(2);
  });

  it('lets data-stream parsing commit replayed text before live tool calls', async () => {
    const { waitForRender, releaseNext } = createRenderWait();
    const setReplaying = vi.fn();
    const replayPrefix = '0:"hi"\nb:{"toolCallId":"call-1","toolName":"te';
    const liveSuffix = 'st"}\n';
    const replayContentLength = encoder.encode(replayPrefix).byteLength;

    const streamPromise = createReplayBoundaryStream(
      createResponse([replayPrefix + liveSuffix], replayContentLength),
      { setReplaying, waitForRender },
    );

    await releaseNext();
    const messages = (await streamPromise)
      .pipeThrough(new DataStreamDecoder())
      .pipeThrough(new AssistantMessageAccumulator({ throttle: true }));
    const reader = messages.getReader();

    let sawReplayedText = false;
    while (!sawReplayedText) {
      const replayedMessage = await reader.read();
      expect(replayedMessage.done).toBe(false);
      expect(replayedMessage.value?.parts.some((part) => part.type === 'tool-call')).toBe(false);
      sawReplayedText =
        replayedMessage.value?.parts.some((part) => part.type === 'text' && part.text === 'hi') ??
        false;
    }
    expect(setReplaying).toHaveBeenCalledTimes(1);

    const liveMessagePromise = reader.read();
    await releaseNext();
    expect(setReplaying).toHaveBeenLastCalledWith(false);
    await releaseNext();

    let liveMessage = await liveMessagePromise;
    while (
      !liveMessage.done &&
      !liveMessage.value?.parts.some(
        (part) => part.type === 'tool-call' && part.toolName === 'test',
      )
    ) {
      liveMessage = await reader.read();
    }
    expect(liveMessage.done).toBe(false);
  });
});
