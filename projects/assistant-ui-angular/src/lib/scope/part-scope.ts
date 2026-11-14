// Ported from packages/vue/src/primitives/PartByIndexProvider.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { AuiConfig, Derived, type AssistantClient } from '@assistant-ui/store/client';
import type { PartMethods } from '@assistant-ui/core/store';
import { createLastValidCache, createStaleReporter } from './last-valid-cache';

/**
 * The scope config for the message part at `index`: descendants read it
 * through `s.part`. `aui` is the parent (message-level) client; `isCurrent`
 * reports whether the owner still targets `index` (stale reports are skipped
 * otherwise).
 */
export function partScopeConfig(
  aui: AssistantClient,
  index: number,
  isCurrent: () => boolean,
): AuiConfig {
  const cache = createLastValidCache<PartMethods>(
    createStaleReporter({
      name: 'PartByIndexProvider',
      index,
      isCurrent,
      isValid: () => index < aui.message.getState().parts.length,
    }),
  );
  return AuiConfig({
    part: Derived({
      source: 'message',
      query: { type: 'index', index },
      get: (aui) =>
        cache.resolve(index < aui.message.getState().parts.length, () =>
          aui.message.part({ index }),
        ),
    }),
  });
}
