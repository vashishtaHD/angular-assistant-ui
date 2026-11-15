// Ported from packages/react/src/primitives/chainOfThought/ChainOfThoughtAccordionTrigger.tsx @ 7d74276
// and packages/vue/src/primitives/ChainOfThoughtPrimitiveAccordionTrigger.ts @ 7d74276
import { Directive, input } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';

/**
 * A button that toggles `s.chainOfThought.collapsed`. Exposes the disclosure
 * state through `aria-expanded`. A click that is default-prevented by the
 * caller does not toggle.
 *
 * @example
 * ```html
 * <button auiChainOfThoughtAccordionTrigger>Toggle reasoning</button>
 * ```
 */
@Directive({
  selector: 'button[auiChainOfThoughtAccordionTrigger]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
  host: { '[attr.aria-expanded]': '!collapsed()' },
})
export class AuiChainOfThoughtAccordionTriggerDirective {
  /** Disables the trigger. */
  readonly disabled = input(false);

  private readonly aui = injectAui();
  /** True while the chain of thought is collapsed. */
  protected readonly collapsed = injectAuiState((s) => s.chainOfThought.collapsed);

  constructor() {
    injectActionButton({
      disabled: () => this.disabled(),
      onClick: () => this.aui.chainOfThought.setCollapsed(!this.collapsed()),
    });
  }
}
