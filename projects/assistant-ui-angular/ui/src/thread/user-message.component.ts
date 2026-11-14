// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (UserMessage) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { AuiMessagePartsComponent, AuiMessageRootDirective } from 'angular-assistant-ui';
import { AuiThreadUserActionBarComponent } from './action-bars';
import { AuiThreadBranchPickerComponent } from './branch-picker.component';

/**
 * A user message (the `UserMessage` slot): the bubble, the edit action beside
 * it and the branch picker under it.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-user-message',
  standalone: true,
  imports: [
    AuiMessageRootDirective,
    AuiMessagePartsComponent,
    AuiThreadUserActionBarComponent,
    AuiThreadBranchPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div auiMessageRoot class="aui-user-message-root" data-slot="aui_user-message-root">
    <div class="aui-user-message-content-wrapper">
      <div class="aui-user-message-content"><aui-message-parts /></div>
      <div class="aui-user-action-bar-wrapper"><aui-thread-user-action-bar /></div>
    </div>
    <div class="aui-user-branch-picker" data-slot="aui_user-branch-picker">
      <aui-thread-branch-picker />
    </div>
  </div>`,
})
export class AuiThreadUserMessageComponent {}
