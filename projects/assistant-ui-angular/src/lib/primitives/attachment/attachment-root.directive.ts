// Ported from packages/react/src/primitives/attachment/AttachmentRoot.tsx @ 7d74276
// (data-type / data-status are Angular additions so chips can be styled by state)
import { Directive } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/**
 * Marks the wrapper element of one attachment, inside an attachment scope
 * (`aui-composer-attachments` / `aui-message-attachments` templates). Sets
 * `data-type` (`image`, `document` or `file`) and `data-status` (the status
 * type, e.g. `running`, `requires-action` or `complete`).
 *
 * @example
 * ```html
 * <div auiAttachmentRoot><aui-attachment-name /></div>
 * ```
 */
@Directive({
  selector: '[auiAttachmentRoot]',
  standalone: true,
  host: {
    '[attr.data-type]': 'type()',
    '[attr.data-status]': 'status()',
  },
})
export class AuiAttachmentRootDirective {
  /** @internal */
  protected readonly type = injectAuiState((s) => s.attachment.type);
  /** @internal */
  protected readonly status = injectAuiState((s) => s.attachment.status.type);
}
