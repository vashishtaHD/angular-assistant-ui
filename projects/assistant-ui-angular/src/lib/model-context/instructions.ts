// Ported from packages/core/src/react/model-context/useAssistantInstructions.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { bindToClient } from './bind-client';

/**
 * A value, or a signal (or any getter) of it. Getters are read each time they
 * are needed, so a signal keeps the registration current.
 */
export type MaybeSignal<T> = T | (() => T);

/** Reads a {@link MaybeSignal} (signals are functions, plain values are not called). */
export function readMaybeSignal<T>(value: MaybeSignal<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

/** Object form accepted by {@link injectAssistantInstructions}. */
export interface AssistantInstructionsOptions {
  /** The system instruction. */
  instruction: MaybeSignal<string>;
  /** When true the instruction contributes nothing. */
  disabled?: MaybeSignal<boolean> | undefined;
}

/**
 * Registers a system instruction in the assistant's model context for the
 * lifetime of the injection context (React's `useAssistantInstructions`).
 *
 * Pass a string, a signal of one, or `{ instruction, disabled }`. Signals are
 * read every time the model context is pulled, so a changing signal updates
 * the instruction with no re-registration. Must be called in an injection
 * context under an `[auiProvider]` whose config mounts a `modelContext`
 * scope (`RuntimeAdapter` mounts one).
 *
 * @example
 * ```ts
 * constructor() {
 *   injectAssistantInstructions('You are a helpful pirate.');
 * }
 * ```
 */
export function injectAssistantInstructions(
  config: MaybeSignal<string> | AssistantInstructionsOptions,
): void {
  const options: AssistantInstructionsOptions =
    typeof config === 'object' && config !== null && 'instruction' in config
      ? config
      : { instruction: config as MaybeSignal<string> };
  bindToClient(injectAssistantInstructions, (client) =>
    client.modelContext().register({
      getModelContext: () =>
        readMaybeSignal(options.disabled ?? false)
          ? {}
          : { system: readMaybeSignal(options.instruction) },
    }),
  );
}
