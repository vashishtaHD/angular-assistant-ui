// Ported from packages/react/src/primitives/attachment/AttachmentThumb.tsx @ 7d74276
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/**
 * The short label for an attachment: the dotted last extension of `name`
 * (`report.pdf` gives `.pdf`, `a.tar.gz` gives `.gz`), or `type` when the name
 * has no usable extension (no dot, a leading dot, a trailing dot, or empty).
 */
export function getAttachmentThumbLabel(name: string, type: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? `.${name.slice(dot + 1)}` : type;
}

/**
 * Renders the current attachment's {@link getAttachmentThumbLabel | label}
 * (extension, else type) as text. Projected content replaces the label.
 * This is upstream's `AttachmentPrimitive.unstable_Thumb`; the image preview
 * is {@link AuiAttachmentThumbDirective}.
 *
 * @example
 * ```html
 * <aui-attachment-thumb-label />
 * <aui-attachment-thumb-label>PDF</aui-attachment-thumb-label>
 * ```
 */
@Component({
  selector: 'aui-attachment-thumb-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content>{{ label() }}</ng-content>`,
})
export class AuiAttachmentThumbLabelComponent {
  /** @internal */
  protected readonly label = injectAuiState((s) =>
    getAttachmentThumbLabel(s.attachment.name, s.attachment.type),
  );
}
