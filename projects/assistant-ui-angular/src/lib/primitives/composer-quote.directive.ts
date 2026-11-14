// Ported from packages/react/src/primitives/composer/ComposerQuote.tsx @ 7d74276
import {
  ChangeDetectorRef,
  DestroyRef,
  Directive,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { getProxiedAssistantState } from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from './action-button';

/**
 * Renders its template only while the composer has a quote. Structural: use it
 * with the `*` syntax.
 *
 * @example
 * ```html
 * <div *auiComposerQuote>
 *   <span auiComposerQuoteText></span>
 *   <button auiComposerQuoteDismiss>×</button>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiComposerQuote]',
  standalone: true,
})
export class AuiComposerQuoteDirective {
  private readonly template = inject(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly source = injectAuiContext().source;
  private hasView = false;

  constructor() {
    const unsubscribe = this.source.subscribe(() => this.update());
    inject(DestroyRef).onDestroy(unsubscribe);
    this.update();
  }

  private update(): void {
    const show = !!getProxiedAssistantState(this.source.getClient()).optional.composer?.quote;
    if (show === this.hasView) return;
    this.hasView = show;
    if (show) this.viewContainer.createEmbeddedView(this.template);
    else this.viewContainer.clear();
    this.cdr.markForCheck();
  }
}

/**
 * Renders the quoted text as the element's text content; empty and hidden
 * (`hidden` plus a host `display: none` style binding, so class-based author
 * CSS such as `.flex` cannot show it) when there is no quote.
 */
@Directive({
  selector: '[auiComposerQuoteText]',
  standalone: true,
  host: {
    '[textContent]': 'text()',
    '[hidden]': '!text()',
    '[style.display]': 'text() ? null : "none"',
  },
})
export class AuiComposerQuoteTextDirective {
  /** @internal */
  protected readonly text = injectAuiState((s) => s.optional.composer?.quote?.text ?? '');
}

/** A button that clears the quote from the composer. */
@Directive({
  selector: 'button[auiComposerQuoteDismiss]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
})
export class AuiComposerQuoteDismissDirective {
  private readonly aui = injectAui();

  constructor() {
    injectActionButton({
      disabled: () => false,
      onClick: () => this.aui.composer.setQuote(undefined),
    });
  }
}
