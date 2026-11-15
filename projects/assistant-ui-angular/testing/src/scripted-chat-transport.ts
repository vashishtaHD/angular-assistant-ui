// Original (no upstream counterpart): a scripted AI SDK chat transport for tests.
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';

/**
 * One scripted assistant turn for {@link createScriptedChatTransport}: either
 * the chunks to stream back (each one `delayMs` apart when set), or an error
 * that the send rejects with (as a failed request would).
 */
export type ScriptedTurn = { chunks: UIMessageChunk[]; delayMs?: number } | { error: Error };

const abortError = (): Error => {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
};

/**
 * Creates an AI SDK `ChatTransport` that answers each send from a script
 * instead of the network, for tests of chat UIs (for example
 * `AISDKChat({ transport })` from `@assistant-ui/ai-sdk`).
 *
 * Given an array, the n-th send plays the n-th turn and a send past the end
 * rejects. Given a function, every send plays the turn it returns for the
 * messages being sent. Aborting a send errors its stream with an
 * `AbortError`, as `fetch` does. `reconnectToStream` always resolves `null`
 * (there is never a stream to resume).
 *
 * @example
 * ```ts
 * const transport = createScriptedChatTransport([
 *   {
 *     chunks: [
 *       { type: 'start' },
 *       { type: 'text-start', id: 't1' },
 *       { type: 'text-delta', id: 't1', delta: 'Hi there!' },
 *       { type: 'text-end', id: 't1' },
 *       { type: 'finish' },
 *     ],
 *   },
 *   { error: new Error('network') },
 * ]);
 * ```
 */
export function createScriptedChatTransport(
  script: ScriptedTurn[] | ((messages: UIMessage[]) => ScriptedTurn),
): ChatTransport<UIMessage> {
  let next = 0;
  const nextTurn = (messages: UIMessage[]): ScriptedTurn => {
    if (typeof script === 'function') return script(messages);
    const turn = script[next];
    if (!turn) {
      throw new Error(`ScriptedChatTransport: no scripted turn left for send #${next + 1}`);
    }
    next++;
    return turn;
  };

  return {
    sendMessages: async ({ messages, abortSignal }) => {
      if (abortSignal?.aborted) throw abortError();
      const turn = nextTurn(messages);
      if ('error' in turn) throw turn.error;
      return streamChunks(turn.chunks, turn.delayMs, abortSignal);
    },
    reconnectToStream: async () => null,
  };
}

function streamChunks(
  chunks: readonly UIMessageChunk[],
  delayMs: number | undefined,
  abortSignal: AbortSignal | undefined,
): ReadableStream<UIMessageChunk> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const cleanup = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (onAbort) abortSignal?.removeEventListener('abort', onAbort);
    onAbort = undefined;
  };

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      if (!delayMs) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
        return;
      }
      onAbort = () => {
        cleanup();
        controller.error(abortError());
      };
      abortSignal?.addEventListener('abort', onAbort);
      let index = 0;
      const step = () => {
        timer = undefined;
        if (index < chunks.length) controller.enqueue(chunks[index++]!);
        if (index < chunks.length) {
          timer = setTimeout(step, delayMs);
        } else {
          cleanup();
          controller.close();
        }
      };
      timer = setTimeout(step, delayMs);
    },
    cancel() {
      cleanup();
    },
  });
}
