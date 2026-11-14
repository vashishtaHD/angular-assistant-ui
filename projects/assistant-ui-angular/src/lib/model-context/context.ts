// Ported from packages/core/src/react/model-context/useAssistantContext.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import type { AssistantContextConfig } from '@assistant-ui/core';
import { bindToClient } from './bind-client';
import { readMaybeSignal, type MaybeSignal } from './instructions';

export type { AssistantContextConfig };

/** Options of {@link injectAssistantContext} beyond the context getter. */
export interface AssistantContextOptions {
  /** When true the context contributes nothing. */
  disabled?: MaybeSignal<boolean> | undefined;
}

/**
 * Registers a dynamic system context in the model context for the lifetime of
 * the injection context (React's `useAssistantContext`). `getContext` runs
 * every time the model context is pulled, so it can read signals and always
 * returns fresh text.
 *
 * @example
 * ```ts
 * injectAssistantContext(() => `Cart has ${this.cart.count()} items`);
 * ```
 */
export function injectAssistantContext(
  getContext: () => string,
  options: AssistantContextOptions = {},
): void {
  bindToClient(injectAssistantContext, (client) =>
    client.modelContext().register({
      getModelContext: () =>
        readMaybeSignal(options.disabled ?? false) ? {} : { system: getContext() },
    }),
  );
}
