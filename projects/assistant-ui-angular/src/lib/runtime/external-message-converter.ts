// Ported from packages/core/src/react/runtimes/external-message-converter.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the ambient types must reach the ng-packagr build, which only compiles files reachable from the entry
/// <reference path="./tap-react-shim.d.ts" />
import type { ThreadMessage } from '@assistant-ui/core';
import { useExternalMessageConverter, type JoinStrategy } from '@assistant-ui/core/store';
import { createTapRoot, flushTapSync } from '@assistant-ui/tap';
import { useState } from '@assistant-ui/tap/react-shim';

/** The callback that converts one external message into thread message content. */
export type ExternalMessageConverterCallback<T> = useExternalMessageConverter.Callback<T>;

/** Metadata passed to every conversion. */
export type ExternalMessageConverterMetadata = useExternalMessageConverter.Metadata;

/** Options of {@link createExternalMessageConverter}. */
export interface ExternalMessageConverterOptions<T extends WeakKey> {
  /** Converts one external message. Keep it referentially stable. */
  callback: ExternalMessageConverterCallback<T>;
  /** How adjacent assistant messages are joined (`'none'` keeps them apart). */
  joinStrategy?: JoinStrategy | undefined;
  /**
   * Returns the metadata dependency for one message. It must change whenever
   * the metadata the callback reads for that message changes.
   */
  getMetadataKey?: useExternalMessageConverter.GetMetadataKey<T> | undefined;
}

/** The function {@link createExternalMessageConverter} returns. */
export type ExternalMessageConverter<T extends WeakKey> = (
  messages: T[],
  isRunning: boolean,
  metadata?: ExternalMessageConverterMetadata,
) => ThreadMessage[];

/**
 * Creates a converter from external messages to `ThreadMessage`s that keeps a
 * conversion cache (the Angular face of React's `useExternalMessageConverter`).
 * An unchanged source message converts to the same `ThreadMessage` object on
 * every call. It runs core's own hook inside a tap root, so `joinStrategy`
 * and `getMetadataKey` behave exactly as in React. Keep `callback` and
 * `metadata` referentially stable.
 *
 * @example
 * ```ts
 * const convert = createExternalMessageConverter<MyMessage>({
 *   callback: (m) => ({ role: m.role, content: m.text }),
 *   joinStrategy: 'none',
 * });
 * const messages = convert(myMessages, isRunning);
 * ```
 */
export function createExternalMessageConverter<T extends WeakKey>(
  options: ExternalMessageConverterOptions<T> | ExternalMessageConverterCallback<T>,
): ExternalMessageConverter<T> {
  const { callback, joinStrategy, getMetadataKey }: ExternalMessageConverterOptions<T> =
    typeof options === 'function' ? { callback: options } : options;
  let input: { messages: T[]; isRunning: boolean; metadata?: ExternalMessageConverterMetadata } = {
    messages: [],
    isRunning: false,
  };
  let bump: (() => void) | undefined;
  const root = createTapRoot(() => {
    const [, setTick] = useState(0);
    bump = () => setTick((tick) => tick + 1);
    return useExternalMessageConverter<T>({
      callback,
      messages: input.messages,
      isRunning: input.isRunning,
      joinStrategy,
      metadata: input.metadata,
      getMetadataKey,
    });
  });
  // Mount the root so state updates re-render it.
  root.subscribe(() => undefined);

  return (messages, isRunning, metadata) => {
    input = { messages, isRunning, metadata };
    flushTapSync(() => bump?.());
    return root.getValue();
  };
}
