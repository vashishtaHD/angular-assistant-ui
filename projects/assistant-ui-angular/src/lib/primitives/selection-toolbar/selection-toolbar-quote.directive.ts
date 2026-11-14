// Ported from packages/react/src/primitives/selectionToolbar/SelectionToolbarQuote.tsx @ 7d74276
import { Directive, booleanAttribute, inject, input } from '@angular/core';
import { injectAui } from '../../state/inject-aui';
import { AuiSelectionToolbarRootDirective } from './selection-toolbar-root.directive';

/**
 * A button that quotes the current selection: it sets the selected text and
 * message id as the thread composer's quote, then clears the browser
 * selection. Disabled while the toolbar holds no selection.
 *
 * Must be inside `[auiSelectionToolbarRoot]`.
 */
@Directive({
  selector: 'button[auiSelectionToolbarQuote]',
  standalone: true,
  host: {
    type: 'button',
    '[disabled]': 'disabled() || !toolbar.info()',
    '(click)': 'onClick($event)',
  },
})
export class AuiSelectionToolbarQuoteDirective {
  private readonly aui = injectAui();
  /** @internal */
  protected readonly toolbar = inject(AuiSelectionToolbarRootDirective);

  /** Consumer-controlled disabled flag. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** @internal */
  protected onClick(event: MouseEvent): void {
    const info = this.toolbar.info();
    if (event.defaultPrevented || !info) return;
    this.aui.thread.composer().setQuote({ text: info.text, messageId: info.messageId });
    window.getSelection()?.removeAllRanges();
  }
}
