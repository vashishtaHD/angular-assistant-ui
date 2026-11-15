// Ported from packages/core/src/react/primitive-hooks/useThreadMessageIds.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { computed, type Signal } from '@angular/core';
import { injectAuiState } from './inject-aui-state';

/**
 * The ids of the messages in the current thread, in order (React's
 * `unstable_useThreadMessageIds`).
 *
 * The signal keeps a stable array identity across content-only updates (for
 * example streaming) and only changes when the id sequence changes, which suits
 * custom or virtualized message lists.
 *
 * @deprecated Experimental since 2026-06-23. Not scheduled for removal; the API may change in any release.
 */
export function unstable_injectThreadMessageIds(): Signal<readonly string[]> {
  const messages = injectAuiState((s) => s.thread.messages);
  let previous: readonly string[] = [];
  return computed(() => {
    const ids = messages().map((m) => m.id);
    if (previous.length !== ids.length || previous.some((id, i) => id !== ids[i])) {
      previous = ids;
    }
    return previous;
  });
}
