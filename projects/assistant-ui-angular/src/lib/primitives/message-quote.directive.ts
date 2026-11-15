// Ported from packages/core/src/react/primitives/message/MessageQuote.tsx @ 7d74276
// and packages/core/src/react/utils/getMessageQuote.ts, packages/react/src/hooks/useMessageQuote.ts
import { Directive, type Signal } from '@angular/core';
import type { QuoteInfo } from '@assistant-ui/core';
import type { AssistantState } from '@assistant-ui/store/client';
import { injectAuiState } from '../state/inject-aui-state';
import { AuiStateGateDirective, type AuiStateGateContext } from './state-gate';

/** Reads the quote from `message.metadata.custom.quote`. */
const messageQuote = (state: AssistantState): QuoteInfo | undefined => {
  const metadata: unknown = state.message.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;
  return (metadata as { custom?: Record<string, unknown> }).custom?.['quote'] as
    QuoteInfo | undefined;
};

/**
 * Signal of the quote info of the current message, if any (read from
 * `message.metadata.custom.quote`). Must be called in an injection context
 * inside a message scope.
 *
 * @example
 * ```ts
 * readonly quote = injectMessageQuote();
 * // template: @if (quote(); as q) { <blockquote>{{ q.text }}</blockquote> }
 * ```
 */
export function injectMessageQuote(): Signal<QuoteInfo | undefined> {
  return injectAuiState(messageQuote);
}

/** The context of `*auiMessageQuote`: the quote (`let-quote`). */
export type AuiMessageQuoteContext = AuiStateGateContext<QuoteInfo>;

/**
 * Renders its template when the current message carries quote metadata
 * (`message.metadata.custom.quote`); the implicit context value is the
 * {@link QuoteInfo} (`text` and `messageId`). Structural: use it with the
 * `*` syntax. Place it above `aui-message-parts` in the message layout.
 *
 * @example
 * ```html
 * <blockquote *auiMessageQuote="let quote">{{ quote.text }}</blockquote>
 * <aui-message-parts />
 * ```
 */
@Directive({
  selector: '[auiMessageQuote]',
  standalone: true,
})
export class AuiMessageQuoteDirective extends AuiStateGateDirective<QuoteInfo> {
  /** Types the template context (`let-quote`) as the quote. */
  static ngTemplateContextGuard(
    directive: AuiMessageQuoteDirective,
    context: unknown,
  ): context is AuiMessageQuoteContext {
    void directive;
    void context;
    return true;
  }

  protected select(state: AssistantState) {
    return messageQuote(state);
  }
}
