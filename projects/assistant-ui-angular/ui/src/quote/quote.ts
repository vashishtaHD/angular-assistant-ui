// Ported from packages/ui/src/components/react/assistant-ui/elements/quote.aui.tsx @ 7d74276
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import {
  AuiComposerQuoteDirective,
  AuiComposerQuoteDismissDirective,
  AuiComposerQuoteTextDirective,
  AuiSelectionToolbarQuoteDirective,
  AuiSelectionToolbarRootDirective,
} from 'angular-assistant-ui';
import { AuiIconComponent } from '../icons/icon.component';

/**
 * Renders quoted text in a user message (upstream's `QuoteBlock`). Use it in
 * the template of `*auiMessageQuote`.
 *
 * @example
 * ```html
 * <aui-quote-block *auiMessageQuote="let quote" [text]="quote.text" />
 * ```
 */
@Component({
  selector: 'aui-quote-block',
  standalone: true,
  imports: [AuiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'aui-quote-block', 'data-slot': 'quote-block' },
  template: `<aui-icon name="quote" class="aui-quote-block-icon" data-slot="quote-block-icon" />
    <p class="aui-quote-block-text" data-slot="quote-block-text">{{ text() }}</p>`,
})
export class AuiQuoteBlockComponent {
  /** The quoted text. */
  readonly text = input.required<string>();
}

/**
 * The quote preview inside the composer (upstream's `ComposerQuotePreview`):
 * the quoted text and a dismiss button. Renders only while the composer has
 * a quote. Place it inside `form[auiComposerRoot]`.
 *
 * @example
 * ```html
 * <form auiComposerRoot>
 *   <aui-quote-composer />
 *   <textarea auiComposerInput></textarea>
 * </form>
 * ```
 */
@Component({
  selector: 'aui-quote-composer',
  standalone: true,
  imports: [
    AuiComposerQuoteDirective,
    AuiComposerQuoteTextDirective,
    AuiComposerQuoteDismissDirective,
    AuiIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { style: 'display: contents' },
  template: `<div *auiComposerQuote class="aui-composer-quote" data-slot="composer-quote">
    <aui-icon name="quote" class="aui-composer-quote-icon" data-slot="composer-quote-icon" />
    <span
      auiComposerQuoteText
      class="aui-composer-quote-text"
      data-slot="composer-quote-text"
    ></span>
    <button
      type="button"
      auiComposerQuoteDismiss
      class="aui-composer-quote-dismiss"
      data-slot="composer-quote-dismiss"
      aria-label="Dismiss quote"
    >
      <aui-icon name="x" />
    </button>
  </div>`,
})
export class AuiQuoteComposerComponent {}

/**
 * The floating toolbar shown while text inside one message is selected
 * (upstream's `SelectionToolbar`), with a Quote button that sets the
 * selection as the composer's quote. Fixed-positioned above the selection;
 * hidden (inline `display: none`) otherwise. Render it once inside the thread
 * root.
 *
 * @example
 * ```html
 * <div auiThreadRoot>… <aui-selection-toolbar-styled /></div>
 * ```
 */
@Component({
  selector: 'aui-selection-toolbar-styled',
  standalone: true,
  imports: [AuiIconComponent, AuiSelectionToolbarQuoteDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: AuiSelectionToolbarRootDirective, inputs: ['threadRoot'] }],
  host: {
    class: 'aui-root aui-selection-toolbar',
    'data-slot': 'selection-toolbar',
    '[style.position]': 'rect() ? "fixed" : null',
    '[style.top.px]': 'rect() ? rect()!.top - 8 : null',
    '[style.left.px]': 'rect() ? rect()!.left + rect()!.width / 2 : null',
  },
  template: `<button
    auiSelectionToolbarQuote
    class="aui-selection-toolbar-quote"
    data-slot="selection-toolbar-quote"
  >
    <aui-icon name="quote" />Quote
  </button>`,
})
export class AuiSelectionToolbarStyledComponent {
  private readonly toolbar = inject(AuiSelectionToolbarRootDirective);
  /** @internal */
  protected readonly rect = computed(() => this.toolbar.rect());
}
