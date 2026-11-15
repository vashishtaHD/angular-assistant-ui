// Ported from packages/core/src/react/primitives/messagePart/MessagePartInProgress.ts @ 7d74276
import { Directive } from '@angular/core';
import type { AssistantState } from '@assistant-ui/store/client';
import { AuiStateGateDirective } from './state-gate';

/**
 * Renders its template only while the current part is running. Structural:
 * use it with the `*` syntax, inside a part scope.
 *
 * @example
 * ```html
 * <aui-part-text />
 * <span *auiPartInProgress>&#9679;</span>
 * ```
 */
@Directive({
  selector: '[auiPartInProgress]',
  standalone: true,
})
export class AuiPartInProgressDirective extends AuiStateGateDirective<true> {
  protected select(state: AssistantState) {
    return state.part.status.type === 'running' ? (true as const) : undefined;
  }
}
