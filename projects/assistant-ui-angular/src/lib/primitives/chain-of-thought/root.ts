// Ported from packages/react/src/primitives/chainOfThought/ChainOfThoughtRoot.tsx @ 7d74276
import { Directive } from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/**
 * The root element of a chain of thought. Sets `data-collapsed` (an empty
 * attribute, absent while expanded) from `s.chainOfThought.collapsed`, so it
 * can be styled. Use it inside a chain of thought scope, for example in the
 * `auiChainOfThought` template of `AuiMessagePartsComponent`.
 *
 * @example
 * ```html
 * <div auiChainOfThoughtRoot>
 *   <button auiChainOfThoughtAccordionTrigger>Reasoning</button>
 *   <aui-chain-of-thought-parts>...</aui-chain-of-thought-parts>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiChainOfThoughtRoot]',
  standalone: true,
  host: { '[attr.data-collapsed]': 'collapsed() ? "" : null' },
})
export class AuiChainOfThoughtRootDirective {
  /** True while the chain of thought is collapsed. */
  protected readonly collapsed = injectAuiState((s) => s.chainOfThought.collapsed);
}
