// Original angular-assistant-ui demo code (no upstream counterpart; no code copied).
import {
  ReadableStream,
  TextDecoderStream,
  TextEncoderStream,
  TransformStream,
  WritableStream,
} from 'node:stream/web';

// jsdom does not expose the WHATWG streams that `assistant-stream` and the AI
// SDK use; borrow Node's implementation (as the library's test setup does).
const g = globalThis as Record<string, unknown>;
g['ReadableStream'] ??= ReadableStream;
g['WritableStream'] ??= WritableStream;
g['TransformStream'] ??= TransformStream;
// The AI SDK's HTTP chat transport decodes SSE bodies with `TextDecoderStream`.
g['TextDecoderStream'] ??= TextDecoderStream;
g['TextEncoderStream'] ??= TextEncoderStream;
