// Ported from packages/react/src/primitives/dropdownMenuRenderPrimitives.ts @ 7d74276
import { Directive } from '@angular/core';

/** A visual divider between menu items (`role="separator"`). */
@Directive({
  selector: '[auiMenuSeparator]',
  standalone: true,
  host: { role: 'separator', 'aria-orientation': 'horizontal' },
})
export class AuiMenuSeparatorDirective {}
