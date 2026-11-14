// Ported from packages/react/src/primitives/error/ErrorRoot.tsx and ErrorMessage.tsx @ 7d74276
// (Vue: packages/vue/src/primitives/error.ts)
import { ChangeDetectionStrategy, Component, Directive } from '@angular/core';
import { messageErrorText } from '@assistant-ui/core/store/internal';
import { injectAuiState } from '../state/inject-aui-state';

/**
 * The container of a message's error. Carries `role="alert"`; when the error
 * stands for a run another tab or session drives, it carries
 * `data-run-state` (`stale` or `in-progress`) and an in-progress run is
 * announced as `role="status"` instead.
 *
 * @example
 * ```html
 * <div auiErrorRoot *auiMessageError>
 *   <span auiErrorMessage></span>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiErrorRoot]',
  standalone: true,
  host: {
    '[attr.role]': "runState() === 'in-progress' ? 'status' : 'alert'",
    '[attr.data-run-state]': 'runState() ?? null',
  },
})
export class AuiErrorRootDirective {
  /** The run state of the scoped message, when it has one. */
  protected readonly runState = injectAuiState<string | undefined>(
    (s) => s.optional.message?.runState,
  );
}

/**
 * Renders the current message's error text (`messageErrorText`: a string,
 * the `message` of an error object, or `An error occurred`). Projected
 * content replaces the text. While the message has no error the element is
 * hidden and renders nothing.
 *
 * @example
 * ```html
 * <span auiErrorMessage></span>
 * <span auiErrorMessage>Something went wrong</span>
 * ```
 */
@Component({
  // The attribute selector is the contract (`<span auiErrorMessage>`), like the
  // other primitives, so the host element stays the consumer's.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[auiErrorMessage]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[hidden]': 'error() === undefined' },
  template: `
    @if (error() !== undefined) {
      <ng-content>{{ errorText() }}</ng-content>
    }
  `,
})
export class AuiErrorMessageComponent {
  /** The error as the store reports it; `undefined` while there is none. */
  protected readonly error = injectAuiState(messageErrorText);

  /** The error as text. */
  protected errorText(): string {
    return String(this.error());
  }
}
