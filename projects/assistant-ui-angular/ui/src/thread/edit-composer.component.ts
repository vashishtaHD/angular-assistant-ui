// Ported from packages/ui/src/components/react/assistant-ui/elements/thread.aui.tsx (EditComposer) @ 7d74276
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import {
  AuiComposerCancelDirective,
  AuiComposerInputDirective,
  AuiComposerRootDirective,
  AuiComposerSendDirective,
  AuiMessageRootDirective,
} from 'angular-assistant-ui';
import { AuiButtonDirective } from '../button.directive';

/**
 * The edit composer shown in place of a message being edited (the
 * `EditComposer` slot): the input, Cancel and Update. Update sends the edit
 * as a new branch; Cancel restores the message.
 * @internal Part of `aui-thread`.
 */
@Component({
  selector: 'aui-thread-edit-composer',
  standalone: true,
  imports: [
    AuiMessageRootDirective,
    AuiComposerRootDirective,
    AuiComposerInputDirective,
    AuiComposerSendDirective,
    AuiComposerCancelDirective,
    AuiButtonDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div
    auiMessageRoot
    class="aui-edit-composer-wrapper"
    data-slot="aui_edit-composer-wrapper"
  >
    <form auiComposerRoot class="aui-edit-composer-root">
      <textarea
        auiComposerInput
        autoFocus
        class="aui-edit-composer-input"
        aria-label="Edit message"
      ></textarea>
      <div class="aui-edit-composer-footer">
        <button auiButton variant="ghost" size="sm" auiComposerCancel>Cancel</button>
        <button auiButton size="sm" auiComposerSend>Update</button>
      </div>
    </form>
  </div>`,
})
export class AuiThreadEditComposerComponent {}
