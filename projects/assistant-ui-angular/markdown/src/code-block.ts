// Ported from packages/react-markdown/src/overrides/{CodeOverride,CodeBlock,defaultComponents}.tsx @ 7d74276
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  isDevMode,
  reflectComponentType,
  signal,
  untracked,
  type Type,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { AUI_SYNTAX_HIGHLIGHTER } from './highlighter.token';
import type { CodeBlockNode } from './markdown-api';
import { AuiMarkdownRenderContext } from './markdown-context';

/**
 * The default code block header of `aui-markdown-text`, which renders
 * nothing. Write your own with the same `language` and `code` inputs (a
 * language label and a copy button, say) and pass it as
 * `components.codeHeader` or per language in `componentsByLanguage`. A header
 * (or `highlighter` component) that also declares a `node` input receives the
 * block's `CodeBlockNode` (upstream's `node` prop); one without it never gets it.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'app-code-header',
 *   template: `<div class="aui-code-header-root">{{ language() }}</div>`,
 * })
 * export class CodeHeaderComponent {
 *   readonly language = input.required<string>();
 *   readonly code = input.required<string>();
 * }
 * ```
 */
@Component({
  selector: 'aui-code-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
// The name is the public API this entry documents (upstream's `CodeHeader`).
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class AuiCodeHeader {
  /** The fence language, `''` when the fence has none. */
  readonly language = input<string>('');
  /** The code of the block. */
  readonly code = input<string>('');
}

const nodeInputs = new WeakMap<Type<unknown>, boolean>();

/**
 * Whether `component` declares a `node` input. Only those get one: binding an input a component
 * does not declare is an error in Angular, so the `node` of upstream's `CodeHeaderProps` and
 * `SyntaxHighlighterProps` is opt-in.
 */
const declaresNodeInput = (component: Type<unknown>): boolean => {
  let declared = nodeInputs.get(component);
  if (declared === undefined) {
    declared =
      reflectComponentType(component)?.inputs.some((entry) => entry.templateName === 'node') ??
      false;
    nodeInputs.set(component, declared);
  }
  return declared;
};

interface Highlighted {
  readonly code: string;
  readonly language: string;
  readonly html: SafeHtml;
}

/**
 * Renders one fenced code block (or `$$` math block) of `aui-markdown-text`:
 * the code header, then the body. The body is, in order of precedence, the
 * `highlighter` component for the language (`componentsByLanguage`, then
 * `components`), the `AUI_SYNTAX_HIGHLIGHTER` markup once it resolves, or a
 * plain `<pre class="aui-md-pre"><code class="language-…">`. While a newer
 * highlight is pending, the last highlighted markup for the language stays.
 * @internal Rendered by `aui-markdown-text`.
 */
@Component({
  selector: 'aui-markdown-code-block',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `@if (header(); as header) {
      <ng-container *ngComponentOutlet="header; inputs: headerInputs()" />
    }
    @if (highlighterComponent(); as body) {
      <ng-container *ngComponentOutlet="body; inputs: bodyInputs()" />
    } @else {
      @if (highlighted(); as html) {
        <div class="aui-md-code-highlighted" [innerHTML]="html"></div>
      } @else {
        <pre class="aui-md-pre"><code [class]="codeClass()">{{ code() }}</code></pre>
      }
    }`,
})
export class AuiMarkdownCodeBlockComponent {
  /** The fence language, `''` when the fence has none. */
  readonly language = input<string>('');
  /** The code of the block. */
  readonly code = input.required<string>();
  /** A `$$` math block, which renders with the `math-display` class. */
  readonly math = input<boolean>(false);
  /** The block's AST node (upstream's `node` prop), for components that declare a `node` input. */
  readonly node = input<CodeBlockNode | undefined>(undefined);

  private readonly context = inject(AuiMarkdownRenderContext);
  private readonly highlighter = inject(AUI_SYNTAX_HIGHLIGHTER, { optional: true });
  private readonly sanitizer = inject(DomSanitizer);
  private destroyed = false;
  private sequence = 0;
  private requested: { code: string; language: string } | null = null;
  private readonly latest = signal<Highlighted | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  private readonly byLanguage = computed(
    () => this.context.componentsByLanguage()[this.language()],
  );

  /** The code header component, or `null` for the default (which renders nothing). */
  protected readonly header = computed(
    () => this.byLanguage()?.codeHeader ?? this.context.components().codeHeader ?? null,
  );

  /** The component that renders the body in place of the highlighter, if any. */
  protected readonly highlighterComponent = computed(
    () => this.byLanguage()?.highlighter ?? this.context.components().highlighter ?? null,
  );

  /** The header's inputs: `language` and `code`, plus `node` when the component declares it. */
  protected readonly headerInputs = computed(() => this.inputsFor(this.header()));
  /** The highlighter component's inputs, as for the header. */
  protected readonly bodyInputs = computed(() => this.inputsFor(this.highlighterComponent()));

  private inputsFor(component: Type<unknown> | null): Record<string, unknown> {
    const inputs: Record<string, unknown> = { language: this.language(), code: this.code() };
    if (component && declaresNodeInput(component)) inputs['node'] = this.node();
    return inputs;
  }

  protected readonly codeClass = computed(() => {
    const language = this.language();
    if (this.math()) return 'language-math math-display';
    return language ? `language-${language}` : '';
  });

  /**
   * The trusted highlighter markup for the current code. While a newer highlight is pending, the
   * last markup stays only if the code grew from it (streaming appends) in the same language; a
   * replacement shows the plain current code instead of the old code's markup.
   */
  protected readonly highlighted = computed<SafeHtml | null>(() => {
    if (this.highlighterComponent() || !this.highlighter) return null;
    const code = this.code();
    const language = this.language();
    this.request(code, language);
    const latest = this.latest();
    return latest && latest.language === language && code.startsWith(latest.code)
      ? latest.html
      : null;
  });

  /**
   * Asks the highlighter for `code` once per change. A computed only starts
   * the request; the result is written from the promise callback, and only
   * when no newer request was made since.
   */
  private request(code: string, language: string): void {
    const requested = this.requested;
    if (requested && requested.code === code && requested.language === language) return;
    this.requested = { code, language };
    const sequence = ++this.sequence;
    let pending: Promise<string> | null;
    try {
      // Outside the reactive context: the highlighter's own signal reads must
      // not become dependencies, and its signal writes must be allowed.
      const highlighter = this.highlighter!;
      pending = untracked(() => highlighter.highlight(code, language));
    } catch (error) {
      this.warn(error);
      pending = null;
    }
    if (!pending) {
      // Plain text for this code: drop markup that belongs to older code.
      if (this.latest()?.code !== code) queueMicrotask(() => this.settle(sequence, null));
      return;
    }
    pending.then(
      (html) => this.settle(sequence, { code, language, html }),
      (error: unknown) => {
        this.warn(error);
        this.settle(sequence, null);
      },
    );
  }

  private settle(
    sequence: number,
    result: { code: string; language: string; html: string } | null,
  ): void {
    if (this.destroyed || sequence !== this.sequence) return;
    // Only markup the highlighter produced is trusted; the code it was given
    // is the highlighter's to escape (see AuiSyntaxHighlighter).
    this.latest.set(
      result && {
        code: result.code,
        language: result.language,
        html: this.sanitizer.bypassSecurityTrustHtml(result.html),
      },
    );
  }

  private warn(error: unknown): void {
    if (isDevMode()) {
      console.warn('[aui-markdown-text] The syntax highlighter failed; showing plain code.', error);
    }
  }
}
