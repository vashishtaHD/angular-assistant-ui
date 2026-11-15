// Original (no upstream counterpart): the documented public surface of the vendored packages/markdown @ 7d74276.
import type * as Ast from './vendor/markdown/ast';
import { parseMarkdown as vendorParseMarkdown } from './vendor/markdown/parse';
import {
  createMarkdownSession as vendorCreateMarkdownSession,
  type MarkdownSession as VendorMarkdownSession,
  type MarkdownSessionUpdateOptions as VendorMarkdownSessionUpdateOptions,
} from './vendor/markdown/session';

/**
 * Parses a complete markdown text (CommonMark plus tables, strikethrough, task
 * lists, autolinks and `$`/`$$`/`\(`/`\[` math) into a framework-neutral AST.
 */
export const parseMarkdown: (source: string) => Ast.RootNode = vendorParseMarkdown;

/**
 * Creates a streaming markdown session: `update(text, { final })` reparses
 * only the blocks that can still change and returns every earlier block as
 * the same object. Until `final`, syntax left open at the end renders closed.
 */
export const createMarkdownSession: () => VendorMarkdownSession = vendorCreateMarkdownSession;

/** A streaming markdown session; see {@link createMarkdownSession}. */
export type MarkdownSession = VendorMarkdownSession;
/** Options of {@link MarkdownSession.update}. */
export type MarkdownSessionUpdateOptions = VendorMarkdownSessionUpdateOptions;

/** The zero-based source lines a block spans, `end` exclusive. */
export type LineRange = Ast.LineRange;
/** The root of a parsed document. */
export type RootNode = Ast.RootNode;
/** A paragraph block. */
export type ParagraphNode = Ast.ParagraphNode;
/** An ATX or setext heading, `depth` 1 to 6. */
export type HeadingNode = Ast.HeadingNode;
/** A thematic break (`---`). */
export type ThematicBreakNode = Ast.ThematicBreakNode;
/** A block quote. */
export type BlockquoteNode = Ast.BlockquoteNode;
/** An ordered or bullet list. */
export type ListNode = Ast.ListNode;
/** A list item; `checked` is set on a task list item. */
export type ListItemNode = Ast.ListItemNode;
/** A fenced or indented code block. */
export type CodeBlockNode = Ast.CodeBlockNode;
/** A `$$` display math block. */
export type MathBlockNode = Ast.MathBlockNode;
/** A raw HTML block (rendered as text). */
export type HtmlBlockNode = Ast.HtmlBlockNode;
/** A column alignment of a table. */
export type TableAlign = Ast.TableAlign;
/** A table: the header row followed by the body rows. */
export type TableNode = Ast.TableNode;
/** A table row. */
export type TableRowNode = Ast.TableRowNode;
/** A table cell. */
export type TableCellNode = Ast.TableCellNode;
/** Plain text. */
export type TextNode = Ast.TextNode;
/** Emphasis (`*em*`). */
export type EmphasisNode = Ast.EmphasisNode;
/** Strong emphasis (`**strong**`). */
export type StrongNode = Ast.StrongNode;
/** Strikethrough (`~~gone~~`). */
export type StrikethroughNode = Ast.StrikethroughNode;
/** An inline code span. */
export type CodeSpanNode = Ast.CodeSpanNode;
/** Inline math; `display` when written with `$$` or `\[`. */
export type MathInlineNode = Ast.MathInlineNode;
/** A link with a safe destination. */
export type LinkNode = Ast.LinkNode;
/** An image. */
export type ImageNode = Ast.ImageNode;
/** Raw inline HTML (rendered as text). */
export type HtmlInlineNode = Ast.HtmlInlineNode;
/** A hard line break. */
export type HardBreakNode = Ast.HardBreakNode;
/** A soft line break. */
export type SoftBreakNode = Ast.SoftBreakNode;
/** Any block node. */
export type BlockNode = Ast.BlockNode;
/** Any inline node. */
export type InlineNode = Ast.InlineNode;
/** Any node of the AST. */
export type MarkdownNode = Ast.MarkdownNode;
