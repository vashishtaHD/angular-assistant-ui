// Ported from packages/react/src/primitives/attachment/AttachmentName.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/** Renders the current attachment's file name as text. */
@Component({
  selector: 'aui-attachment-name',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ name() }}`,
})
export class AuiAttachmentNameComponent {
  /** @internal */
  protected readonly name = injectAuiState((s) => s.attachment.name);
}
