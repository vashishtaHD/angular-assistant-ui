// Original (no upstream counterpart): scripted mock language model for the Mastra server specs.
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/** Stream parts for a plain text reply. */
export function textStep(text: string, id = 't1'): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id },
    { type: 'text-delta', id, delta: text },
    { type: 'text-end', id },
    { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
  ];
}

/** Stream parts for a single tool call that ends the step with `tool-calls`. */
export function toolCallStep(
  toolName: string,
  input: unknown,
  toolCallId = 'call-1',
): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
    { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage },
  ];
}

export interface ScriptedModel {
  model: MockLanguageModelV3;
  /** Calls received by `doStream`, one entry per model call. */
  calls: () => MockLanguageModelV3['doStreamCalls'];
}

/**
 * A mock model that plays one scripted step per `doStream` call and then falls back to a text reply.
 * `doGenerate` (used for thread titles) always answers "Title".
 */
export function scriptedModel(steps: LanguageModelV3StreamPart[][] = []): ScriptedModel {
  const queue = [...steps];
  const model = new MockLanguageModelV3({
    doStream: async () => {
      const parts = queue.shift() ?? textStep('ok');
      return {
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'Title' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    }),
  });
  return { model, calls: () => model.doStreamCalls };
}
