// Ported from packages/markdown/src/vue/Markdown.ts @ 7d74276
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  computed,
  inject,
  input,
  type Signal,
  type Type,
} from '@angular/core';
import { AuiMarkdownCodeBlockComponent } from './code-block';
import { AuiMarkdownRenderContext } from './markdown-context';
import type {
  BlockNode,
  CodeBlockNode,
  HeadingNode,
  ImageNode,
  InlineNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MathInlineNode,
  TableNode,
} from './vendor/markdown/ast';
import { plainText } from './vendor/markdown/plain-text';

/** A node `[auiMdNodes]` renders: a block or an inline. */
export type AuiMarkdownChildNode = BlockNode | InlineNode;

/** The checkbox of a task list item, rendered before the first content of its target. */
export interface AuiMarkdownTask {
  readonly checked: boolean;
  /** The accessible name: the text of the item's first paragraph. */
  readonly label: string | null;
  /** A space separates the checkbox from paragraph text that follows it. */
  readonly space: boolean;
}

interface ListItemView {
  readonly tight: boolean;
  readonly paragraphOverride: boolean;
  /** The children of the `<li>`; a tight item's paragraphs are replaced by their inlines. */
  readonly nodes: readonly AuiMarkdownChildNode[];
  /** The checkbox before the `<li>` content. */
  readonly task: AuiMarkdownTask | null;
  /** The checkbox inside the first paragraph of a loose item. */
  readonly firstTask: AuiMarkdownTask | null;
}

// Mirrors markdown-it's validateLink: the tokenizer never produces these, and
// the renderer refuses them too, rendering the link text instead.
const UNSAFE_URL = /^(vbscript|javascript|file|data):/i;
const SAFE_DATA_URL = /^data:image\/(gif|png|jpeg|webp);/i;
const isSafeUrl = (url: string): boolean => {
  const trimmed = url.trim();
  return !UNSAFE_URL.test(trimmed) || SAFE_DATA_URL.test(trimmed);
};

/** Replaces links with an unsafe destination by their children (an empty one stays, as upstream). */
const withSafeLinks = (nodes: readonly AuiMarkdownChildNode[]): readonly AuiMarkdownChildNode[] => {
  if (!nodes.some((node) => node.type === 'link' && !isSafeUrl(node.url))) {
    return nodes;
  }
  return nodes.flatMap((node) =>
    node.type === 'link' && !isSafeUrl(node.url) ? withSafeLinks(node.children) : [node],
  );
};

const SOFT_BREAK = '\n';

/**
 * The shared rendering of a list of markdown nodes: each block or inline
 * renders through a `@switch` on its type, or through its override from
 * `components`. Nodes are tracked by position and type (see `keyOf`), so
 * every block keeps its view and DOM while the message streams; a block the
 * session kept (it settled) passes unchanged inputs, so its `OnPush` children
 * skip change detection.
 */
export const NODES_TEMPLATE = `@if (task(); as task) {<input
    type="checkbox"
    disabled
    [checked]="task.checked"
    [attr.aria-label]="task.label"
  />@if (task.space) {<ng-container>{{ space }}</ng-container>}}@for (node of items(); track keyOf($index, node); let first = $first) {@if (overrideOf(node); as override) {<ng-container
      *ngComponentOutlet="override; inputs: { node: node }"
    />} @else {@switch (node.type) {
      @case ('text') {<ng-container>{{ value(node) }}</ng-container>}
      @case ('htmlInline') {<ng-container>{{ value(node) }}</ng-container>}
      @case ('softBreak') {<ng-container>{{ softBreak }}</ng-container>}
      @case ('hardBreak') {<br />}
      @case ('emphasis') {<em [auiMdNodes]="inlines(node)"></em>}
      @case ('strong') {<strong class="aui-md-strong" [auiMdNodes]="inlines(node)"></strong>}
      @case ('strikethrough') {<del [auiMdNodes]="inlines(node)"></del>}
      @case ('codeSpan') {<code class="aui-md-inline-code">{{ value(node) }}</code>}
      @case ('mathInline') {<code
          class="language-math"
          [class.math-display]="mathInline(node).display"
          [class.math-inline]="!mathInline(node).display"
        >{{ value(node) }}</code>}
      @case ('link') {<a
          class="aui-md-a"
          [href]="link(node).url"
          [attr.title]="link(node).title ?? null"
          [auiMdNodes]="inlines(node)"
        ></a>}
      @case ('image') {<img
          referrerpolicy="no-referrer"
          [src]="image(node).url"
          [alt]="image(node).alt"
          [attr.title]="image(node).title ?? null"
        />}
      @case ('paragraph') {<p
          class="aui-md-p"
          [auiMdNodes]="inlines(node)"
          [auiMdTask]="first ? firstTask() : null"
        ></p>}
      @case ('heading') {@switch (heading(node).depth) {
        @case (1) {<h1 class="aui-md-h1" [auiMdNodes]="inlines(node)"></h1>}
        @case (2) {<h2 class="aui-md-h2" [auiMdNodes]="inlines(node)"></h2>}
        @case (3) {<h3 class="aui-md-h3" [auiMdNodes]="inlines(node)"></h3>}
        @case (4) {<h4 class="aui-md-h4" [auiMdNodes]="inlines(node)"></h4>}
        @case (5) {<h5 class="aui-md-h5" [auiMdNodes]="inlines(node)"></h5>}
        @default {<h6 class="aui-md-h6" [auiMdNodes]="inlines(node)"></h6>}
      }}
      @case ('thematicBreak') {<hr class="aui-md-hr" />}
      @case ('blockquote') {<blockquote class="aui-md-blockquote" [auiMdNodes]="blocks(node)"></blockquote>}
      @case ('list') {@if (list(node).ordered) {<ol class="aui-md-ol" [attr.start]="start(node)"><ng-container
          *ngTemplateOutlet="listItems; context: { $implicit: list(node) }"
        /></ol>} @else {<ul class="aui-md-ul"><ng-container
          *ngTemplateOutlet="listItems; context: { $implicit: list(node) }"
        /></ul>}}
      @case ('codeBlock') {<aui-markdown-code-block
          [language]="codeBlock(node).lang ?? ''"
          [code]="codeBlock(node).value"
          [node]="codeBlock(node)"
        />}
      @case ('mathBlock') {<aui-markdown-code-block
          [language]="'math'"
          [code]="value(node)"
          [math]="true"
        />}
      @case ('htmlBlock') {<p class="aui-md-p">{{ value(node) }}</p>}
      @case ('table') {<table class="aui-md-table">@if (table(node).children[0]; as head) {<thead><tr
            class="aui-md-tr"
          >@for (cell of head.children; track $index; let column = $index) {<th
              class="aui-md-th"
              [style.text-align]="table(node).align[column]"
              [auiMdNodes]="cell.children"
            ></th>}</tr></thead>}@if (table(node).children.length > 1) {<tbody>@for (
            row of table(node).children;
            track $index;
            let index = $index
          ) {@if (index > 0) {<tr class="aui-md-tr">@for (
                cell of row.children;
                track $index;
                let column = $index
              ) {<td
                  class="aui-md-td"
                  [style.text-align]="table(node).align[column]"
                  [auiMdNodes]="cell.children"
                ></td>}</tr>}}</tbody>}</table>}
    }}}<ng-template #listItems let-list>@for (item of list.children; track $index) {@if (
      overrideOf(item);
      as override
    ) {<ng-container *ngComponentOutlet="override; inputs: { node: item }" />} @else {<li
        class="aui-md-li"
        [auiMdNodes]="listItem(item, list).nodes"
        [auiMdTask]="listItem(item, list).task"
        [auiMdFirstTask]="listItem(item, list).firstTask"
      ></li>}}</ng-template>`;

/**
 * The template helpers shared by `aui-markdown-text` and `[auiMdNodes]`.
 * @internal
 */
@Directive()
export abstract class AuiMarkdownRenderer {
  /** The nodes to render. */
  protected abstract readonly items: Signal<readonly AuiMarkdownChildNode[]>;
  /** The checkbox rendered before the nodes. */
  protected abstract readonly task: Signal<AuiMarkdownTask | null>;
  /** The checkbox rendered inside the first node, a paragraph. */
  protected abstract readonly firstTask: Signal<AuiMarkdownTask | null>;

  protected readonly context = inject(AuiMarkdownRenderContext);
  protected readonly softBreak = SOFT_BREAK;
  /**
   * Tracks a node by its position and type. The streaming session keeps the
   * objects of settled blocks, so their views see unchanged inputs and their
   * `OnPush` children skip change detection; the open trailing block gets a
   * new object on every update and keeps its view (a code block keeps its
   * component and its highlight), with its inputs updated in place.
   */
  protected keyOf(index: number, node: AuiMarkdownChildNode): string {
    return `${index}:${node.type}`;
  }
  protected readonly space = ' ';
  private readonly listItems = new WeakMap<ListItemNode, ListItemView>();

  /** The override for `node`'s type, if any. */
  protected overrideOf(node: AuiMarkdownChildNode | ListItemNode): Type<unknown> | null {
    return this.context.components()[node.type] ?? null;
  }

  protected value(node: AuiMarkdownChildNode): string {
    return (node as { value: string }).value;
  }
  protected inlines(node: AuiMarkdownChildNode): readonly InlineNode[] {
    return (node as { children: InlineNode[] }).children;
  }
  protected blocks(node: AuiMarkdownChildNode): readonly BlockNode[] {
    return (node as { children: BlockNode[] }).children;
  }
  protected heading(node: AuiMarkdownChildNode): HeadingNode {
    return node as HeadingNode;
  }
  protected list(node: AuiMarkdownChildNode): ListNode {
    return node as ListNode;
  }
  protected start(node: AuiMarkdownChildNode): number | null {
    const { start } = node as ListNode;
    return start === undefined || start === 1 ? null : start;
  }
  protected table(node: AuiMarkdownChildNode): TableNode {
    return node as TableNode;
  }
  protected link(node: AuiMarkdownChildNode): LinkNode {
    return node as LinkNode;
  }
  protected image(node: AuiMarkdownChildNode): ImageNode {
    return node as ImageNode;
  }
  protected codeBlock(node: AuiMarkdownChildNode): CodeBlockNode {
    return node as CodeBlockNode;
  }
  protected mathInline(node: AuiMarkdownChildNode): MathInlineNode {
    return node as MathInlineNode;
  }

  /**
   * How a list item renders, as upstream's Vue `ListItem`: a tight item's
   * paragraphs render their inlines without a `<p>` (unless a paragraph
   * override takes them), and a task item's checkbox goes before the first
   * paragraph's text. Cached per item object so the bindings keep their
   * identity across change detection.
   */
  protected listItem(item: ListItemNode, list: ListNode): ListItemView {
    const paragraphOverride = this.context.components().paragraph !== undefined;
    const cached = this.listItems.get(item);
    if (cached && cached.tight === list.tight && cached.paragraphOverride === paragraphOverride) {
      return cached;
    }
    const [first] = item.children;
    const firstIsParagraph = first?.type === 'paragraph';
    const checkbox: AuiMarkdownTask | null =
      item.checked === undefined
        ? null
        : {
            checked: item.checked,
            label: firstIsParagraph ? plainText(first.children) : null,
            space: firstIsParagraph,
          };
    // A loose item's checkbox goes inside its first paragraph's <p>; otherwise
    // (tight, no leading paragraph, or a paragraph override) before the content.
    const inParagraph = checkbox !== null && firstIsParagraph && !list.tight && !paragraphOverride;
    const nodes = item.children.flatMap((child): readonly AuiMarkdownChildNode[] =>
      child.type === 'paragraph' && list.tight && !paragraphOverride ? child.children : [child],
    );
    const view: ListItemView = {
      tight: list.tight,
      paragraphOverride,
      nodes,
      task: inParagraph ? null : checkbox,
      firstTask: inParagraph ? checkbox : null,
    };
    this.listItems.set(item, view);
    return view;
  }
}

/**
 * Renders markdown nodes (blocks or inlines) inside its host element, with
 * the `components` of the enclosing `aui-markdown-text`. Use it in an override
 * component to render the node's children.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'app-md-link',
 *   imports: [AuiMarkdownNodesComponent],
 *   template: `<a [href]="node().url" target="_blank" [auiMdNodes]="node().children"></a>`,
 * })
 * export class LinkComponent {
 *   readonly node = input.required<LinkNode>();
 * }
 * ```
 */
@Component({
  // An attribute selector keeps the host the real element (`<p>`, `<li>`,
  // `<td>`, …), so the rendered markup has no wrapper elements.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[auiMdNodes]',
  standalone: true,
  imports: [NgComponentOutlet, NgTemplateOutlet, AuiMarkdownCodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: NODES_TEMPLATE,
})
export class AuiMarkdownNodesComponent extends AuiMarkdownRenderer {
  /** The nodes to render, for example `node().children`. */
  readonly auiMdNodes = input.required<readonly AuiMarkdownChildNode[]>();
  /**
   * A task list checkbox to render before the nodes.
   * @internal
   */
  readonly auiMdTask = input<AuiMarkdownTask | null>(null);
  /**
   * A task list checkbox to render inside the first node, a paragraph.
   * @internal
   */
  readonly auiMdFirstTask = input<AuiMarkdownTask | null>(null);

  protected readonly items = computed<readonly AuiMarkdownChildNode[]>(() =>
    withSafeLinks(this.auiMdNodes()),
  );
  protected readonly task = this.auiMdTask;
  protected readonly firstTask = this.auiMdFirstTask;
}
