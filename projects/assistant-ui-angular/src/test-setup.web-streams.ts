import {
  ReadableStream,
  TextDecoderStream,
  TextEncoderStream,
  TransformStream,
  WritableStream,
} from 'node:stream/web';

// jsdom does not expose the WHATWG streams that `assistant-stream` (loaded by
// `@assistant-ui/core`) uses (at module level, or when encoding/decoding a
// transport stream); borrow Node's implementation.
const g = globalThis as Record<string, unknown>;
g['ReadableStream'] ??= ReadableStream;
g['WritableStream'] ??= WritableStream;
g['TransformStream'] ??= TransformStream;
g['TextEncoderStream'] ??= TextEncoderStream;
g['TextDecoderStream'] ??= TextDecoderStream;
