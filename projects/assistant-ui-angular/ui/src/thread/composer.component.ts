// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx
// (Composer, ComposerAction) and packages/ui/src/components/vue/assistant-ui/thread.vue @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import {
  AuiComposerCancelDirective,
  AuiComposerInputDirective,
  AuiComposerRootDirective,
  AuiComposerSendDirective,
  AuiIfDirective,
  injectAuiState,
  type AssistantState,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import { AuiIconComponent } from '../icons/icon.component';
import { AuiTooltipDirective } from '../tooltip-icon-button.component';
import { AuiThreadSettings } from './thread-settings';

/**
 * The thread composer (the `Composer` slot): an auto-growing input and a
 * send button that turns into a stop button while the run can be cancelled.
 * The placeholder is `composerPlaceholder` of `aui-thread`.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-composer',
  standalone: true,
  imports: [
    AuiIfDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
    AuiComposerCancelDirective,
    AuiButtonDirective,
    AuiIconComponent,
    AuiTooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<form auiComposerRoot class="aui-composer-root">
    <div class="aui-composer-shell" data-slot="aui_composer-shell">
      <textarea
        auiComposerInput
        autoFocus
        class="aui-composer-input"
        rows="1"
        enterkeyhint="send"
        aria-label="Message input"
        [attr.placeholder]="placeholder()"
      ></textarea>
      <div class="aui-composer-action-wrapper">
        <div class="aui-composer-action-start"></div>
        <div class="aui-composer-action-end">
          <button
            *auiIf="showSend"
            auiButton
            size="icon"
            auiComposerSend
            class="aui-composer-send"
            auiTooltip="Send message"
            aria-label="Send message"
          >
            <aui-icon name="arrow-up" class="aui-composer-send-icon" />
          </button>
          <button
            *auiIf="showCancel"
            auiButton
            size="icon"
            auiComposerCancel
            class="aui-composer-cancel"
            [attr.aria-label]="isSending() ? 'Cancel sending' : 'Stop generating'"
          >
            <aui-icon name="square" class="aui-composer-cancel-icon" />
          </button>
        </div>
      </div>
    </div>
  </form>`,
})
export class AuiThreadComposerComponent {
  private readonly settings = inject(AuiThreadSettings, { optional: true });
  /** @internal */
  protected readonly placeholder = computed(
    () => this.settings?.composerPlaceholder() ?? 'Send a message...',
  );
  /** @internal The stop control only cancels the send while no run it could stop is going. */
  protected readonly isSending = injectAuiState(
    (s) =>
      s.composer.submission !== undefined && !(s.thread.isRunning && s.thread.capabilities.cancel),
  );
  /** @internal */
  protected readonly showSend = (s: AssistantState): boolean => !s.composer.canCancel;
  /** @internal */
  protected readonly showCancel = (s: AssistantState): boolean => s.composer.canCancel;
}
