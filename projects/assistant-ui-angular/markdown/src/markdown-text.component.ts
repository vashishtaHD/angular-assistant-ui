// Ported from packages/markdown/src/vue/Markdown.ts and packages/react-markdown/src/primitives/MarkdownText.tsx @ 7d74276
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { injectMessagePartText, injectSmoothState, type SmoothOptions } from 'angular-assistant-ui';
import { AuiMarkdownCodeBlockComponent } from './code-block';
import {
  AuiMarkdownRenderContext,
  NO_COMPONENTS,
  NO_LANGUAGES,
  isSameComponents,
  isSameComponentsByLanguage,
  type AuiMarkdownComponents,
  type AuiMarkdownComponentsByLanguage,
} from './markdown-context';
import {
  AuiMarkdownNodesComponent,
  AuiMarkdownRenderer,
  NODES_TEMPLATE,
  type AuiMarkdownChildNode,
  type AuiMarkdownTask,
} from './markdown-node.component';
import { createMarkdownSession } from './vendor/markdown/session';

/**
 * Renders the current text (or reasoning) part as markdown, streaming-aware.
 *
 * The text is revealed smoothly (unless `smooth` is `false`), passed through
 * `preprocess`, and parsed by a markdown session kept for this part: blocks
 * that have settled keep their node objects, so their DOM is kept and skips
 * change detection while later blocks stream. Until the part is complete,
 * emphasis, code spans and links left open at the end render as closed, so
 * `**bo` shows as bold rather than literal asterisks. Raw HTML renders as
 * text, and `javascript:` links render as their text.
 *
 * Elements carry the `aui-md-*` classes (`aui-md-p`, `aui-md-h1`…`aui-md-h6`,
 * `aui-md-a`, `aui-md-blockquote`, `aui-md-ul`, `aui-md-ol`, `aui-md-li`,
 * `aui-md-hr`, `aui-md-table`, `aui-md-tr`, `aui-md-th`, `aui-md-td`,
 * `aui-md-pre`, `aui-md-inline-code`, `aui-md-strong`). Fenced code blocks go
 * through `AUI_SYNTAX_HIGHLIGHTER` (plain `<pre><code>` without one). Sets
 * `data-status` to the status the reveal reports.
 *
 * Use inside a part scope, for example in an `auiPart="text"` template of
 * `aui-message-parts`.
 *
 * @example
 * ```html
 * <ng-template auiPart="text">
 *   <aui-markdown-text
 *     [preprocess]="normalizeMathDelimiters"
 *     [components]="{ codeHeader: CodeHeaderComponent }"
 *     [componentsByLanguage]="{ mermaid: { highlighter: MermaidComponent } }"
 *   />
 * </ng-template>
 * ```
 */
@Component({
  selector: 'aui-markdown-text',
  standalone: true,
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    AuiMarkdownNodesComponent,
    AuiMarkdownCodeBlockComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AuiMarkdownRenderContext],
  host: { '[attr.data-status]': 'smoothed().status.type' },
  template: NODES_TEMPLATE,
})
export class AuiMarkdownTextComponent extends AuiMarkdownRenderer {
  /**
   * `true` (default) reveals the text smoothly, `false` shows it as it
   * arrives, and {@link SmoothOptions} tunes the reveal. Off under
   * `prefers-reduced-motion: reduce`.
   */
  readonly smooth = input<boolean | SmoothOptions>(true);
  /**
   * Transforms the revealed text before it is parsed, for example
   * `normalizeMathDelimiters` or `escapeCurrencyDollars`.
   */
  readonly preprocess = input<((text: string) => string) | undefined>(undefined);
  /** Components that replace node elements, the code header, or the code body. */
  readonly components = input<Partial<AuiMarkdownComponents> | undefined>(undefined);
  /** Code header and body components per fence language (for example `mermaid`). */
  readonly componentsByLanguage = input<AuiMarkdownComponentsByLanguage | undefined>(undefined);

  private readonly part = injectMessagePartText();
  private readonly text = computed(() => this.part().text);
  private readonly status = computed(() => this.part().status);
  /** The revealed text and the status to report. */
  protected readonly smoothed = injectSmoothState(this.text, this.status, this.smooth);
  private readonly session = createMarkdownSession();

  private readonly root = computed(() => {
    const { text, status } = this.smoothed();
    const preprocess = this.preprocess();
    return this.session.update(preprocess ? preprocess(text) : text, {
      final: status.type === 'complete',
    });
  });

  protected readonly items = computed<readonly AuiMarkdownChildNode[]>(() => this.root().children);
  protected readonly task = signal<AuiMarkdownTask | null>(null).asReadonly();
  protected readonly firstTask = this.task;

  constructor() {
    super();
    // Inline object literals are fresh on every change detection; compare by
    // content so unchanged maps keep settled blocks from rendering again.
    this.context.components = computed(() => this.components() ?? NO_COMPONENTS, {
      equal: isSameComponents,
    });
    this.context.componentsByLanguage = computed(
      () => this.componentsByLanguage() ?? NO_LANGUAGES,
      { equal: isSameComponentsByLanguage },
    );
  }
}
