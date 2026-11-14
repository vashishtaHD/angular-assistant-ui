import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';

// jsdom does not expose the WHATWG streams that `assistant-stream` and the AI
// SDK use; borrow Node's implementation (as the library's test setup does).
const g = globalThis as Record<string, unknown>;
g['ReadableStream'] ??= ReadableStream;
g['WritableStream'] ??= WritableStream;
g['TransformStream'] ??= TransformStream;
