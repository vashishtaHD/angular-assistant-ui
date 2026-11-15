// Original (no upstream counterpart): the syntax highlighter token of `aui-markdown-text`.
import { InjectionToken } from '@angular/core';

/**
 * Highlights the code of a fenced block for `aui-markdown-text`.
 *
 * Provide one through {@link AUI_SYNTAX_HIGHLIGHTER} (for example with
 * `provideShikiHighlighter()` from `angular-assistant-ui/shiki`).
 */
export interface AuiSyntaxHighlighter {
  /**
   * Highlights `code`, written in `language` (the first word of the fence's
   * info string, `''` when there is none; `'math'` for a `$$` block).
   *
   * Resolve to the complete markup of the block (for example Shiki's
   * `<pre class="shiki">…</pre>`), which replaces the plain `<pre><code>`.
   * The markup is bound as trusted HTML, so it must be produced by the
   * highlighter from the code (escaping it), never copied from the message.
   * Return `null` to keep the plain `<pre><code>` (an unknown language, say).
   * A rejected promise also keeps it.
   */
  highlight(code: string, language: string): Promise<string> | null;
}

/**
 * The syntax highlighter `aui-markdown-text` uses for fenced code blocks.
 * Without a provider, code renders as plain `<pre><code>`.
 *
 * @example
 * ```ts
 * providers: [{ provide: AUI_SYNTAX_HIGHLIGHTER, useValue: myHighlighter }]
 * ```
 */
export const AUI_SYNTAX_HIGHLIGHTER = new InjectionToken<AuiSyntaxHighlighter>(
  'AUI_SYNTAX_HIGHLIGHTER',
);
