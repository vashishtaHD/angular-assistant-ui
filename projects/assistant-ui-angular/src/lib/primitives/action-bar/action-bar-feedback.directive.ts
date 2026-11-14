// Ported from packages/core/src/react/primitive-hooks/useActionBarFeedback.ts @ 7d74276
import { Directive, booleanAttribute, input } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/**
 * A button that submits positive feedback for the message to the runtime's
 * feedback adapter. `data-submitted` is present once positive feedback is
 * recorded on the message.
 */
@Directive({
  selector: 'button[auiActionBarFeedbackPositive]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
  host: { '[attr.data-submitted]': 'isSubmitted() ? "" : null' },
})
export class AuiActionBarFeedbackPositiveDirective {
  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  /** @internal */
  protected readonly isSubmitted = injectAuiState(
    (s) => s.message.metadata.submittedFeedback?.type === 'positive',
  );

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.message.submitFeedback({ type: 'positive' }),
    });
  }
}

/**
 * A button that submits negative feedback for the message to the runtime's
 * feedback adapter. `data-submitted` is present once negative feedback is
 * recorded on the message.
 */
@Directive({
  selector: 'button[auiActionBarFeedbackNegative]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
  host: { '[attr.data-submitted]': 'isSubmitted() ? "" : null' },
})
export class AuiActionBarFeedbackNegativeDirective {
  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  /** @internal */
  protected readonly isSubmitted = injectAuiState(
    (s) => s.message.metadata.submittedFeedback?.type === 'negative',
  );

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.message.submitFeedback({ type: 'negative' }),
    });
  }
}
