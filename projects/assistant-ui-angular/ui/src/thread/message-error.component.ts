// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (MessageError) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import {
  AuiErrorMessageComponent,
  AuiErrorRootDirective,
  AuiMessageErrorDirective,
} from 'angular-assistant-ui';
import { AuiIconComponent } from '../icons/icon.component';

/**
 * The error banner of a message whose run ended in an error. Carries the
 * `data-run-state` of the error root (`stale` or `in-progress`) for styling.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-message-error',
  standalone: true,
  imports: [
    AuiMessageErrorDirective,
    AuiErrorRootDirective,
    AuiErrorMessageComponent,
    AuiIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div *auiMessageError auiErrorRoot class="aui-message-error-root">
    <aui-icon name="alert-circle" class="aui-message-error-icon" />
    <aui-icon name="loader" class="aui-message-error-spinner" />
    <span auiErrorMessage class="aui-message-error-message"></span>
  </div>`,
})
export class AuiThreadMessageErrorComponent {}
