// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (ThreadScrollToBottom) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { AuiThreadScrollToBottomDirective } from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';
import { AuiIconComponent } from '../icons/icon.component';
import { AuiTooltipDirective } from '../tooltip-icon-button.component';

/**
 * The round button above the composer that scrolls the viewport to the
 * bottom. Disabled (and invisible) while the viewport is at the bottom.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-scroll-to-bottom',
  standalone: true,
  imports: [
    AuiThreadScrollToBottomDirective,
    AuiButtonDirective,
    AuiIconComponent,
    AuiTooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<button
    auiButton
    variant="outline"
    size="icon"
    auiThreadScrollToBottom
    class="aui-thread-scroll-to-bottom"
    auiTooltip="Scroll to bottom"
    auiTooltipSide="top"
    aria-label="Scroll to bottom"
  >
    <aui-icon name="arrow-down" />
  </button>`,
})
export class AuiThreadScrollToBottomComponent {}
