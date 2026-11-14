// Ported from packages/react/src/primitives/message/MessageError.ts @ 7d74276
import { Directive } from '@angular/core';
import { messageErrorText } from '@assistant-ui/core/store/internal';
import type { AssistantState } from '@assistant-ui/store/client';
import { AuiStateGateDirective } from './state-gate';

/**
 * Renders its template only while the current message ended in an error
 * (status `incomplete` with reason `error`). Structural: use it with the `*`
 * syntax. The template context's implicit value is the error (text, or the
 * raw error value).
 *
 * @example
 * ```html
 * <div *auiMessageError let-error>
 *   <span auiErrorMessage></span>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiMessageError]',
  standalone: true,
})
export class AuiMessageErrorDirective extends AuiStateGateDirective<
  NonNullable<ReturnType<typeof messageErrorText>>
> {
  protected select(state: AssistantState) {
    return messageErrorText(state);
  }
}
