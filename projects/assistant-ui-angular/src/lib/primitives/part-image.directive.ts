// Ported from packages/react/src/primitives/messagePart/MessagePartImage.tsx @ 7d74276
import { Directive } from '@angular/core';
import { injectMessagePartImage } from './part-state';

/**
 * Sets the `src` of an `<img>` from the current image part. Other attributes
 * (`alt`, `class`, ...) stay yours. Use inside a part scope.
 *
 * @example
 * ```html
 * <img auiPartImage alt="Generated image" />
 * ```
 */
@Directive({
  selector: 'img[auiPartImage]',
  standalone: true,
  host: { '[attr.src]': 'image().image || null' },
})
export class AuiPartImageDirective {
  /** The current part as an image part. */
  protected readonly image = injectMessagePartImage();
}
