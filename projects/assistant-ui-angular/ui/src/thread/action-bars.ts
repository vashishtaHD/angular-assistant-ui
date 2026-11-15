// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx
// (UserActionBar, AssistantActionBar) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import {
  AuiActionBarCopyDirective,
  AuiActionBarEditDirective,
  AuiActionBarExportMarkdownDirective,
  AuiActionBarFeedbackNegativeDirective,
  AuiActionBarFeedbackPositiveDirective,
  AuiActionBarReloadDirective,
  AuiActionBarRootDirective,
  AuiIfDirective,
  injectAuiState,
  type AssistantState,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import {
  AuiDropdownMenuContentDirective,
  AuiDropdownMenuItemDirective,
  AuiDropdownMenuTriggerDirective,
} from '../dropdown-menu/dropdown-menu';
import { AuiIconComponent } from '../icons/icon.component';
import { AuiTooltipDirective } from '../tooltip-icon-button.component';

/**
 * The action bar of a user message: the edit button. Hidden while running,
 * and shown on hover or focus except on the last message.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-user-action-bar',
  standalone: true,
  imports: [
    AuiActionBarRootDirective,
    AuiActionBarEditDirective,
    AuiButtonDirective,
    AuiIconComponent,
    AuiTooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div
    auiActionBarRoot
    hideWhenRunning
    autohide="not-last"
    class="aui-user-action-bar-root"
  >
    <button
      auiButton
      variant="ghost"
      size="icon"
      auiActionBarEdit
      class="aui-user-action-edit"
      auiTooltip="Edit"
      aria-label="Edit"
    >
      <aui-icon name="pencil" />
    </button>
  </div>`,
})
export class AuiThreadUserActionBarComponent {}

/**
 * The action bar of an assistant message: copy (the icon turns into a check
 * while copied), feedback (when the thread supports it), refresh, and a more
 * menu with Export as Markdown. Hidden while running, and shown on hover or
 * focus except on the last message.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-assistant-action-bar',
  standalone: true,
  imports: [
    AuiIfDirective,
    AuiActionBarRootDirective,
    AuiActionBarCopyDirective,
    AuiActionBarReloadDirective,
    AuiActionBarFeedbackPositiveDirective,
    AuiActionBarFeedbackNegativeDirective,
    AuiActionBarExportMarkdownDirective,
    AuiButtonDirective,
    AuiIconComponent,
    AuiTooltipDirective,
    AuiDropdownMenuTriggerDirective,
    AuiDropdownMenuContentDirective,
    AuiDropdownMenuItemDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div
      auiActionBarRoot
      hideWhenRunning
      autohide="not-last"
      class="aui-assistant-action-bar-root"
    >
      <button
        auiButton
        variant="ghost"
        size="icon"
        auiActionBarCopy
        class="aui-assistant-action-copy"
        auiTooltip="Copy"
        aria-label="Copy"
      >
        @if (isCopied()) {
          <aui-icon name="check" />
        } @else {
          <aui-icon name="copy" />
        }
      </button>
      <ng-container *auiIf="hasFeedback">
        <button
          auiButton
          variant="ghost"
          size="icon"
          auiActionBarFeedbackPositive
          class="aui-assistant-action-feedback"
          auiTooltip="Helpful"
          aria-label="Helpful"
        >
          <aui-icon name="thumbs-up" />
        </button>
        <button
          auiButton
          variant="ghost"
          size="icon"
          auiActionBarFeedbackNegative
          class="aui-assistant-action-feedback"
          auiTooltip="Not helpful"
          aria-label="Not helpful"
        >
          <aui-icon name="thumbs-down" />
        </button>
      </ng-container>
      <button
        auiButton
        variant="ghost"
        size="icon"
        auiActionBarReload
        class="aui-assistant-action-reload"
        auiTooltip="Refresh"
        aria-label="Refresh"
      >
        <aui-icon name="refresh-cw" />
      </button>
      <button
        auiButton
        variant="ghost"
        size="icon"
        class="aui-assistant-action-more"
        [auiDropdownMenuTrigger]="more"
        auiTooltip="More"
        aria-label="More"
      >
        <aui-icon name="more-horizontal" />
      </button>
    </div>
    <ng-template #more>
      <div auiDropdownMenuContent class="aui-action-bar-more-content">
        <button auiDropdownMenuItem auiActionBarExportMarkdown class="aui-action-bar-more-item">
          <aui-icon name="file" />
          Export as Markdown
        </button>
      </div>
    </ng-template>`,
})
export class AuiThreadAssistantActionBarComponent {
  /** @internal */
  protected readonly isCopied = injectAuiState((s) => s.message.isCopied);
  /** @internal */
  protected readonly hasFeedback = (s: AssistantState): boolean => !!s.thread.capabilities.feedback;
}
