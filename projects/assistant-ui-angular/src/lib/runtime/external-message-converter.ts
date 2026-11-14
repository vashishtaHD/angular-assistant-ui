// Ported from packages/core/src/react/runtimes/external-message-converter.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { bindExternalStoreMessage, type ThreadMessage } from '@assistant-ui/core';
import {
  convertExternalMessages,
  createExternalMessageConversionCache,
} from '@assistant-ui/core/react';

/** The callback that converts one external message into thread message content. */
export type ExternalMessageConverterCallback<T> = Parameters<
  typeof convertExternalMessages<T & WeakKey>
>[1];

/** Metadata passed to every conversion. */
export type ExternalMessageConverterMetadata = Parameters<
  typeof convertExternalMessages<WeakKey>
>[3];

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
 * every call, so keep `callback` and `metadata` referentially stable.
 *
 * The converted messages are bound to their source messages, so
 * `getExternalStoreMessages` works on them. Unlike the React hook, the join
 * strategy and per-message metadata key options are not exposed: core's
 * public entry points do not export them.
 *
 * @example
 * ```ts
 * const convert = createExternalMessageConverter<MyMessage>((m) => ({ role: m.role, content: m.text }));
 * const messages = convert(myMessages, isRunning);
 * ```
 */
export function createExternalMessageConverter<T extends WeakKey>(
  callback: ExternalMessageConverterCallback<T>,
): ExternalMessageConverter<T> {
  const cache = createExternalMessageConversionCache();
  const emptyMetadata = {} as ExternalMessageConverterMetadata;
  return (messages, isRunning, metadata) => {
    const converted = convertExternalMessages(
      messages,
      callback,
      isRunning,
      metadata ?? emptyMetadata,
      cache,
    );
    bindExternalStoreMessage(converted, messages);
    return converted;
  };
}
