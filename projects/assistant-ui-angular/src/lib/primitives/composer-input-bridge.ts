// Ported from packages/react/src/unstable/useComposerInput.ts @ 7d74276
import { computed, type Signal } from '@angular/core';
import { flushTapSync } from '@assistant-ui/tap';
import type { ComposerSendOptions } from '@assistant-ui/core/store';
import { composerInputDisabled, composerSendDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';

/**
 * Options for {@link injectComposerInput}.
 * @experimental Mirrors React's `Unstable_UseComposerInputOptions`.
 */
export interface ComposerInputOptions {
  /** Extra disabled source, combined with the composer's own. */
  disabled?: () => boolean;
}

/**
 * Headless bridge to the composer text and send action, for building a custom
 * input without `[auiComposerInput]`. Owns no keyboard behaviour, autosize, IME,
 * paste or focus handling.
 * @experimental Mirrors React's `Unstable_ComposerInput`.
 */
export interface ComposerInputBridge {
  /** Current composer text, or `''` while the composer is not editing. */
  value: Signal<string>;
  /** Writes `text` into the composer; a no-op unless the composer is editing. */
  setText(text: string): void;
  /** Sends when `canSend()`; otherwise a no-op. */
  send(options?: ComposerSendOptions): void;
  /** Whether the input is disabled (the option combined with the composer's own sources). */
  isDisabled: Signal<boolean>;
  /** Whether a send is available; false while `isDisabled()`. */
  canSend: Signal<boolean>;
}

/**
 * Ported from `unstable_useComposerInput`. Must be called in an injection context.
 * @experimental
 */
export function injectComposerInput(options: ComposerInputOptions = {}): ComposerInputBridge {
  const aui = injectAui();
  const value = injectAuiState((s) => {
    const composer = s.optional.composer;
    return composer?.isEditing ? composer.text : '';
  });
  const threadDisabled = injectAuiState(composerInputDisabled);
  const sendDisabled = injectAuiState(composerSendDisabled);
  const isDisabled = computed(() => threadDisabled() || !!options.disabled?.());
  const canSend = computed(() => !sendDisabled() && !isDisabled());
  return {
    value,
    isDisabled,
    canSend,
    setText(text) {
      if (!aui.composer.getState().isEditing) return;
      flushTapSync(() => aui.composer.setText(text, { origin: 'user' }));
    },
    send(sendOptions) {
      if (!canSend()) return;
      aui.composer.send(sendOptions);
    },
  };
}
