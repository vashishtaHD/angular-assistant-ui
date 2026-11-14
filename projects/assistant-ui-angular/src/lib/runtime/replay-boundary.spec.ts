// Ported from packages/core/src/react/runtimes/assistant-transport/replayBoundaryStream.test.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
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
});
