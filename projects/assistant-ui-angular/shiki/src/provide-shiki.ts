import type { Provider } from '@angular/core';
import { AUI_SYNTAX_HIGHLIGHTER, type AuiSyntaxHighlighter } from 'angular-assistant-ui/markdown';
import type { HighlighterCore } from 'shiki/core';
import { bundledLanguages } from 'shiki/langs';
import { bundledThemes } from 'shiki/themes';

/** Options of {@link provideShikiHighlighter}. */
export interface ShikiHighlighterOptions {
  /**
   * Languages (names or aliases) to load. Fences in other languages render as
   * plain code. Defaults to ts, tsx, js, jsx, json, bash, shell, python, html,
   * css, scss, sql, yaml, markdown, diff, java, go, rust and csharp.
   */
  langs?: string[];
  /**
   * Shiki theme names for light and dark mode. Defaults to `github-light` and
   * `github-dark`. The light theme is inlined; the dark theme is emitted as
   * `--shiki-dark*` CSS variables for a `.dark` / media-query rule to apply.
   */
  themes?: { light: string; dark: string };
  /**
   * Creates the Shiki highlighter instead of the default (JS regex engine,
   * `shiki/core`). Called once, on the first highlight. It must load the
   * `themes` and every language in `langs`.
   */
  loadHighlighter?: () => Promise<HighlighterCore>;
}

const DEFAULT_LANGS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'bash',
  'shell',
  'python',
  'html',
  'css',
  'scss',
  'sql',
  'yaml',
  'markdown',
  'diff',
  'java',
  'go',
  'rust',
  'csharp',
];

const DEFAULT_THEMES = { light: 'github-light', dark: 'github-dark' };

/**
 * Provides {@link AUI_SYNTAX_HIGHLIGHTER} backed by Shiki, for
 * `aui-markdown-text` code blocks.
 *
 * Shiki and its grammars load lazily on the first highlight (the engine is the
 * JS regex engine, so no WASM). Output is the whole dual-theme `<pre class="shiki">`
 * block; unknown languages resolve to `null` and render as plain code.
 *
 * @example
 * ```ts
 * bootstrapApplication(App, { providers: [provideShikiHighlighter({ langs: ['ts', 'json'] })] });
 * ```
 */
export function provideShikiHighlighter(opts: ShikiHighlighterOptions = {}): Provider[] {
  const themes = opts.themes ?? DEFAULT_THEMES;
  const langNames = (opts.langs ?? DEFAULT_LANGS).map((l) => l.toLowerCase());
  // Aliases share their loader function, so a loader identifies a grammar.
  const loaders = new Set<unknown>();
  for (const name of langNames) {
    const loader = (bundledLanguages as Record<string, unknown>)[name];
    if (loader) loaders.add(loader);
  }
  const known = (language: string): boolean => {
    const loader = (bundledLanguages as Record<string, unknown>)[language.toLowerCase()];
    return !!loader && loaders.has(loader);
  };

  let instance: Promise<HighlighterCore> | undefined;
  const load = (): Promise<HighlighterCore> => {
    instance ??= (
      opts.loadHighlighter?.() ??
      (async () => {
        const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
          import('shiki/core'),
          import('shiki/engine/javascript'),
        ]);
        const themeFor = (name: string) =>
          (bundledThemes as Record<string, () => Promise<never>>)[name]!();
        return createHighlighterCore({
          themes: [themeFor(themes.light), themeFor(themes.dark)],
          langs: [...loaders].map((loader) => (loader as () => Promise<never>)()),
          engine: createJavaScriptRegexEngine(),
        });
      })()
    ).catch((error: unknown) => {
      instance = undefined; // allow a retry on the next highlight
      throw error;
    });
    return instance;
  };

  const highlighter: AuiSyntaxHighlighter = {
    highlight(code, language) {
      if (!known(language)) return null;
      return load().then((shiki) =>
        shiki.codeToHtml(code, {
          lang: language.toLowerCase(),
          themes,
          defaultColor: 'light',
        }),
      );
    },
  };
  return [{ provide: AUI_SYNTAX_HIGHLIGHTER, useValue: highlighter }];
}
