// Ported from packages/vue/src/primitives/MessageByIdProvider.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { AuiConfig, Derived, type AssistantClient } from '@assistant-ui/store/client';
import type { ComposerMethods, MessageMethods } from '@assistant-ui/core/store';
import { createLastValidCache, createStaleReporter } from './last-valid-cache';

const idSets = new WeakMap<readonly { id: string }[], Set<string>>();

/** True when the current thread of `aui` contains a message with `id`. */
export const hasMessage = (aui: AssistantClient, id: string): boolean => {
  const messages = aui.thread.getState().messages;
  let set = idSets.get(messages);
  if (!set) {
    set = new Set(messages.map((message) => message.id));
    idSets.set(messages, set);
  }
  return set.has(id);
};

/**
 * The scope config for the thread message with `id`: descendants read it
 * through `s.message` and its edit composer through `s.composer`. The scope
 * follows the message's identity rather than a positional slot. `aui` is the
 * parent (thread-level) client; `isCurrent` reports whether the owner still
 * targets `id` (stale reports are skipped otherwise).
 */
export function messageScopeConfig(
  aui: AssistantClient,
  id: string,
  isCurrent: () => boolean,
): AuiConfig {
  const messageCache = createLastValidCache<MessageMethods>(
    createStaleReporter({
      name: 'MessageByIdProvider',
      index: id,
      isCurrent,
      isValid: () => hasMessage(aui, id),
    }),
  );
  const composerCache = createLastValidCache<ComposerMethods>(null);
  return AuiConfig({
    message: Derived({
      source: 'thread',
      query: { type: 'id', id },
      get: (aui) => messageCache.resolve(hasMessage(aui, id), () => aui.thread.message({ id })),
    }),
    composer: Derived({
      source: 'message',
      query: {},
      get: (aui) =>
        composerCache.resolve(hasMessage(aui, id), () => aui.thread.message({ id }).composer()),
    }),
  });
}
