// Ported from packages/react/src/hooks/useMessageTiming.ts @ 7d74276
import type { Signal } from '@angular/core';
import type { MessageTiming } from '@assistant-ui/core';
import { injectAuiState } from './inject-aui-state';

/**
 * Signal of the streaming timing of the current assistant message (read from
 * `message.metadata.timing`); `undefined` for other roles and while the
 * runtime reports none. Must be called in an injection context inside a
 * message scope.
 *
 * @example
 * ```ts
 * readonly timing = injectMessageTiming();
 * // template: {{ timing()?.tokensPerSecond?.toFixed(1) }} tok/s
 * ```
 */
export function injectMessageTiming(): Signal<MessageTiming | undefined> {
  return injectAuiState((s) =>
    s.message.role === 'assistant' ? s.message.metadata?.timing : undefined,
  );
}
