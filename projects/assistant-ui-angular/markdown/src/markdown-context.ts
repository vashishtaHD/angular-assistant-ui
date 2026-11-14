// Ported from packages/markdown/src/vue/Markdown.ts and packages/react-markdown/src/code-fence.ts @ 7d74276
import { Injectable, signal, type Signal, type Type } from '@angular/core';
import type { MarkdownNode } from './vendor/markdown/ast';

/** The node types `aui-markdown-text` renders, and so the ones that can be overridden. */
export type AuiMarkdownRenderedNode = Exclude<
  MarkdownNode,
  { type: 'root' | 'tableRow' | 'tableCell' }
>;

/** The node of the given `type`, the `node` input of an override for it. */
export type AuiMarkdownNodeOf<TType extends AuiMarkdownRenderedNode['type']> = Extract<
  AuiMarkdownRenderedNode,
  { type: TType }
>;

/**
 * The components of `aui-markdown-text`, passed as `Partial<AuiMarkdownComponents>`.
 *
 * - A key named after a node type (`paragraph`, `heading`, `link`, `codeBlock`,
 *   …) replaces the default element of that node. The component receives the
 *   node as its required `node` input and renders the node's children, if it
 *   wants them, with `[auiMdNodes]="node().children"` (see
 *   `AuiMarkdownNodesComponent`). Unlike upstream's Vue slot, a task list
 *   checkbox is not passed to a `paragraph` override: it renders just before
 *   the override, inside the `<li>`.
 * - `codeHeader` renders above every fenced code block; the default renders
 *   nothing (see `AuiCodeHeader`).
 * - `highlighter` renders the body of every fenced code block in place of the
 *   `AUI_SYNTAX_HIGHLIGHTER` output.
 *
 * `codeHeader` and `highlighter` receive the `language` and `code` inputs.
 * Each component must declare the inputs it is given (`node`, or `language`
 * and `code`): Angular reports an input a component does not declare.
 * `componentsByLanguage` overrides both per language.
 */
export type AuiMarkdownComponents = Record<AuiMarkdownRenderedNode['type'], Type<unknown>> & {
  codeHeader: Type<unknown>;
  highlighter: Type<unknown>;
};

/**
 * Per-language code block components, keyed by the fence language. Each takes
 * the `language` and `code` inputs.
 *
 * @example
 * ```ts
 * { mermaid: { highlighter: MermaidDiagramComponent } }
 * ```
 */
export type AuiMarkdownComponentsByLanguage = Record<
  string,
  { codeHeader?: Type<unknown> | undefined; highlighter?: Type<unknown> | undefined } | undefined
>;

const NO_COMPONENTS: Partial<AuiMarkdownComponents> = Object.freeze({});
const NO_LANGUAGES: AuiMarkdownComponentsByLanguage = Object.freeze({});

/**
 * The override maps shared by every node of one `aui-markdown-text`.
 * @internal
 */
@Injectable()
export class AuiMarkdownRenderContext {
  /** The node and code block components. */
  components: Signal<Partial<AuiMarkdownComponents>> = signal(NO_COMPONENTS);
  /** The per-language code block components. */
  componentsByLanguage: Signal<AuiMarkdownComponentsByLanguage> = signal(NO_LANGUAGES);
}

/** Two override maps are the same when they hold the same components under the same keys. */
export const isSameComponents = (
  a: Partial<AuiMarkdownComponents>,
  b: Partial<AuiMarkdownComponents>,
): boolean => {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof AuiMarkdownComponents)[];
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key])
  );
};

/** Compares two per-language maps entry by entry, as upstream's `compareComponentsByLanguage`. */
export const isSameComponentsByLanguage = (
  a: AuiMarkdownComponentsByLanguage,
  b: AuiMarkdownComponentsByLanguage,
): boolean => {
  if (a === b) return true;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    if (!Object.hasOwn(b, key)) return false;
    const left = a[key];
    const right = b[key];
    if (left === right) return true;
    if (!left || !right) return false;
    return left.codeHeader === right.codeHeader && left.highlighter === right.highlighter;
  });
};

export { NO_COMPONENTS, NO_LANGUAGES };
