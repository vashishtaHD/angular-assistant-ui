// Ported from packages/core/src/react/runtimes/createMessageConverter.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { computed, assertInInjectionContext, type Signal } from '@angular/core';
import {
  getExternalStoreMessages,
  type ThreadMessage,
  type ThreadRuntimeState,
} from '@assistant-ui/core';
import { convertExternalMessages } from '@assistant-ui/core/store';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import {
  createExternalMessageConverter,
  type ExternalMessageConverter,
  type ExternalMessageConverterCallback,
  type ExternalMessageConverterMetadata,
  type ExternalMessageConverterOptions,
} from './external-message-converter';

/**
 * Creates the conversion helpers for one external message type (React's
 * `createMessageConverter`): thread conversion, and the way back from a thread
 * message (or a part of one) to the external messages it was made from.
 *
 * @example
 * ```ts
 * const converter = unstable_createMessageConverter<MyMessage>((m) => ({ role: m.role, content: m.text }));
 * const messages = converter.toThreadMessages(myMessages);
 * ```
 */
export function createMessageConverter<T extends object>(
  callback: ExternalMessageConverterCallback<T>,
) {
  const result = {
    /** A caching converter for a message list, with `joinStrategy` and `getMetadataKey` options. */
    createThreadMessagesConverter: (
      options: Omit<ExternalMessageConverterOptions<T>, 'callback'> = {},
    ): ExternalMessageConverter<T> => createExternalMessageConverter<T>({ ...options, callback }),
    /** Converts without caching. */
    toThreadMessages: (
      messages: T[],
      isRunning = false,
      metadata: ExternalMessageConverterMetadata = {},
    ): ThreadMessage[] => convertExternalMessages(messages, callback, isRunning, metadata),
    /** The external messages a thread state, message or part was converted from. */
    toOriginalMessages: (
      input: ThreadRuntimeState | ThreadMessage | ThreadMessage['content'][number],
    ): unknown[] => {
      const messages = getExternalStoreMessages(input);
      if (messages.length === 0) throw new Error('No original messages found');
      return messages;
    },
    /** The first of {@link toOriginalMessages}. */
    toOriginalMessage: (
      input: ThreadRuntimeState | ThreadMessage | ThreadMessage['content'][number],
    ): object => result.toOriginalMessages(input)[0] as object,
    /** The original messages of the current part (or message) scope, as a signal. */
    injectOriginalMessages: (): Signal<unknown[]> => {
      assertInInjectionContext(result.injectOriginalMessages);
      const aui = injectAui();
      const part = injectAuiState((s) =>
        aui.part.source ? getExternalStoreMessages(s.part) : undefined,
      );
      const message = injectAuiState((s) => getExternalStoreMessages(s.message));
      return computed(() => {
        const messages = part() ?? message();
        if (messages.length === 0) throw new Error('No original messages found');
        return messages;
      });
    },
    /** The first of {@link injectOriginalMessages}, as a signal. */
    injectOriginalMessage: (): Signal<unknown> => {
      assertInInjectionContext(result.injectOriginalMessage);
      const messages = result.injectOriginalMessages();
      return computed(() => messages()[0]);
    },
  };
  return result;
}
