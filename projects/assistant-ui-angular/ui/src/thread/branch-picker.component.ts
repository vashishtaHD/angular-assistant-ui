// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (BranchPicker) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import {
  AuiBranchPickerCountComponent,
  AuiBranchPickerNextDirective,
  AuiBranchPickerNumberComponent,
  AuiBranchPickerPreviousDirective,
  AuiBranchPickerRootDirective,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import { AuiIconComponent } from '../icons/icon.component';
import { AuiTooltipDirective } from '../tooltip-icon-button.component';

/**
 * Previous/next branch buttons and the `n / count` state of the scoped
 * message. Hidden while the message has a single branch.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-branch-picker',
  standalone: true,
  imports: [
    AuiBranchPickerRootDirective,
    AuiBranchPickerPreviousDirective,
    AuiBranchPickerNextDirective,
    AuiBranchPickerNumberComponent,
    AuiBranchPickerCountComponent,
    AuiButtonDirective,
    AuiIconComponent,
    AuiTooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div auiBranchPickerRoot hideWhenSingleBranch class="aui-branch-picker-root">
    <button
      auiButton
      variant="ghost"
      size="icon"
      auiBranchPickerPrevious
      class="aui-branch-picker-previous"
      auiTooltip="Previous"
      aria-label="Previous"
    >
      <aui-icon name="chevron-left" />
    </button>
    <span class="aui-branch-picker-state">
      <aui-branch-picker-number /> / <aui-branch-picker-count />
    </span>
    <button
      auiButton
      variant="ghost"
      size="icon"
      auiBranchPickerNext
      class="aui-branch-picker-next"
      auiTooltip="Next"
      aria-label="Next"
    >
      <aui-icon name="chevron-right" />
    </button>
  </div>`,
})
export class AuiThreadBranchPickerComponent {}
