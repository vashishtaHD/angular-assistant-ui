// Ported from packages/ui/src/components/react/ui/base/button.tsx @ 7d74276
import { Directive, input } from '@angular/core';

/** Visual variants of `button[auiButton]`. */
export type AuiButtonVariant = 'default' | 'ghost' | 'outline' | 'destructive';
/** Sizes of `button[auiButton]`. */
export type AuiButtonSize = 'sm' | 'md' | 'icon';

/**
 * Styled button. Adds the `aui-button` class and `data-variant` / `data-size`
 * attributes that `styles.css` keys on. Defaults to `type="button"`.
 */
@Directive({
  selector: 'button[auiButton]',
  standalone: true,
  host: {
    class: 'aui-button',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.type]': 'type()',
  },
})
export class AuiButtonDirective {
  /** Visual variant. */
  readonly variant = input<AuiButtonVariant>('default');
  /** Size. */
  readonly size = input<AuiButtonSize>('md');
  /** Native button type. */
  readonly type = input<'button' | 'submit' | 'reset'>('button');
}
