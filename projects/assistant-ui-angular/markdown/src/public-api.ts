/*
 * Public API of the `angular-assistant-ui/markdown` entry point.
 */

// Task 11: streaming markdown renderer over the vendored @assistant-ui/markdown parser.
export { AuiMarkdownTextComponent } from './markdown-text.component';
export { AuiMarkdownNodesComponent, type AuiMarkdownChildNode } from './markdown-node.component';
export { AuiCodeHeader } from './code-block';
export { AUI_SYNTAX_HIGHLIGHTER, type AuiSyntaxHighlighter } from './highlighter.token';
export type {
  AuiMarkdownComponents,
  AuiMarkdownComponentsByLanguage,
  AuiMarkdownNodeOf,
  AuiMarkdownRenderedNode,
} from './markdown-context';

// Vendored parser and session (packages/markdown @ 7d74276): `parseMarkdown`,
// `createMarkdownSession` and the AST node types.
export * from './markdown-api';

// Vendored `preprocess` helpers (packages/react-markdown @ 7d74276).
export {
  escapeCurrencyDollars,
  normalizeMathDelimiters,
  rewriteCustomMathTags,
  rewriteLatexBracketDelimiters,
} from './vendor/react-markdown/preprocess';
// Task 11 end.
