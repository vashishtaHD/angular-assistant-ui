// Ported from packages/vue/src/primitives/suggestions.ts (SuggestionPrimitiveTrigger) @ 7d74276
import { Directive, booleanAttribute, input } from '@angular/core';
import { flushTapSync } from '@assistant-ui/tap';
import { suggestionSendMode, suggestionTriggerDisabled } from '@assistant-ui/core/store/internal';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';

/**
 * A button that triggers the current suggestion (use inside the template of
 * `aui-thread-suggestions`). With `send`, the prompt is appended as a message
 * and starts a run (a queued send never clears a draft the user is still
 * composing). Without it, the prompt replaces the composer text, or is
 * appended to it when `clearComposer` is false. Disabled per core's
 * `suggestionTriggerDisabled` predicate (for example while a run is in flight
 * and sends are blocked).
 */
@Directive({
  selector: 'button[auiSuggestionTrigger]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiSuggestionTriggerDirective {
  /** Send the prompt as a message instead of filling the composer. */
  readonly send = input(false, { transform: booleanAttribute });
  /** Clear (or replace) the composer text; when false the prompt is appended to it. */
  readonly clearComposer = input(true, { transform: booleanAttribute });
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  private readonly prompt = injectAuiState((s) => s.suggestion.prompt);
  private readonly blocked = injectAuiState((s) => suggestionTriggerDisabled(s, this.send()));

  constructor() {
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.trigger(),
    });
  }

  private trigger(): void {
    const aui = this.aui;
    const prompt = this.prompt();
    flushTapSync(() => {
      if (this.send()) {
        const mode = suggestionSendMode(aui.thread.getState());
        if (mode === 'blocked') return;
        aui.thread.append({
          content: [{ type: 'text', text: prompt }],
          runConfig: aui.composer.getState().runConfig,
        });
        if (this.clearComposer() && mode === 'now') aui.composer.setText('');
      } else if (this.clearComposer()) {
        aui.composer.setText(prompt);
      } else {
        const current = aui.composer.getState().text;
        aui.composer.setText([current, prompt].filter((part) => part.trim()).join(' '));
      }
    });
  }
}
