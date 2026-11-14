// Ported from packages/vue/src/primitives/messageAttachments.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiAttachmentListBase, AuiAttachmentViewComponent } from './attachment/attachment-list';

/**
 * Renders the current user message's attachments in order (the submission's
 * attachments while a send is in flight), each in its own attachment scope.
 * Renders nothing for non-user messages. Give it an `ng-template
 * auiAttachment` per attachment type, or one bare template for all. Adds no
 * box of its own.
 */
@Component({
  selector: 'aui-message-attachments',
  standalone: true,
  imports: [AuiScopeOutletComponent, AuiAttachmentViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <ng-template #view><aui-attachment-view [templates]="templateMap()" /></ng-template>
    @for (key of keys(); track key) {
      <aui-scope-outlet [config]="configFor(key, $index)" [template]="view" />
    }
  `,
})
export class AuiMessageAttachmentsComponent extends AuiAttachmentListBase {
  /** @internal */
  protected readonly source = 'message';
  private readonly items = injectAuiState((s) =>
    s.message.role === 'user'
      ? (s.message.submission?.attachments ?? s.message.attachments)
      : undefined,
  );
  /** @internal */
  protected readonly attachments = () => this.items() ?? [];
}
