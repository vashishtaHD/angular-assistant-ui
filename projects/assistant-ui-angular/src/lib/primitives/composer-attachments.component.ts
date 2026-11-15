// Ported from packages/vue/src/primitives/composerAttachments.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuiScopeOutletComponent } from '../scope/scope-outlet.component';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiAttachmentListBase, AuiAttachmentViewComponent } from './attachment/attachment-list';

/**
 * Renders the composer's pending attachments in order, each in its own
 * attachment scope (descendants read it through `s.attachment`) and keyed by
 * the attachment id. Give it an `ng-template auiAttachment` per attachment
 * type, or one bare template for all. Adds no box of its own.
 */
@Component({
  selector: 'aui-composer-attachments',
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
export class AuiComposerAttachmentsComponent extends AuiAttachmentListBase {
  /** @internal */
  protected readonly source = 'composer';
  private readonly items = injectAuiState((s) => s.composer.attachments);
  /** @internal */
  protected readonly attachments = () => this.items();
}
