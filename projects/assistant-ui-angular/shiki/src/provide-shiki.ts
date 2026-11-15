// Angular-native DI redesign of packages/ui/src/components/react/assistant-ui/elements/shiki-highlighter.tsx @ 7d74276 (no code copied).
import { isDevMode, type Provider } from '@angular/core';
import { AUI_SYNTAX_HIGHLIGHTER, type AuiSyntaxHighlighter } from 'angular-assistant-ui/markdown';
import type { HighlighterCore } from 'shiki/core';
import { bundledLanguages } from 'shiki/langs';
import { bundledThemes } from 'shiki/themes';

/** Options of {@link provideShikiHighlighter}. */
export interface ShikiHighlighterOptions {
  /**
   * Languages (names or aliases of Shiki's bundled grammars) to load. Fences in
   * other languages render as plain code; custom grammars are not recognised,
   * even with `loadHighlighter`. Unknown names are ignored (warned about in
   * dev mode). Defaults to ts, tsx, js, jsx, json, bash, shell, python, html,
   * css, scss, sql, yaml, markdown, diff, java, go, rust and csharp.
   */
  langs?: string[];
  /**
   * Shiki theme names for light and dark mode. Defaults to `github-light` and
   * `github-dark`; must be names of Shiki's bundled themes (an unknown name
   * throws when the provider is created, unless `loadHighlighter` is given).
   * Colours are emitted as `light-dark(<light>, <dark>)` plus `--shiki-light*`
   * and `--shiki-dark*` variables, so the block follows the CSS `color-scheme`
   * of its container (light when none is set). Put `color-scheme: light dark`
   * on the scope, or `dark` on your dark-mode class, to switch.
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
  if (!opts.loadHighlighter) {
    for (const name of [themes.light, themes.dark]) {
      if (!Object.hasOwn(bundledThemes, name)) {
        throw new Error(
          `provideShikiHighlighter: unknown Shiki theme "${name}". Use a bundled theme name or pass loadHighlighter.`,
        );
      }
    }
  }
  const langNames = (opts.langs ?? DEFAULT_LANGS).map((l) => l.toLowerCase());
  // Aliases share their loader function, so a loader identifies a grammar.
  const loaders = new Set<unknown>();
  for (const name of langNames) {
    const loader = Object.hasOwn(bundledLanguages, name)
      ? (bundledLanguages as Record<string, unknown>)[name]
      : undefined;
    if (loader) loaders.add(loader);
    else if (isDevMode()) {
      console.warn(`provideShikiHighlighter: unknown language "${name}" ignored.`);
    }
  }
  const known = (language: string): boolean => {
    const key = language.toLowerCase();
    const loader = Object.hasOwn(bundledLanguages, key)
      ? (bundledLanguages as Record<string, unknown>)[key]
      : undefined;
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
          defaultColor: 'light-dark()',
        }),
      );
    },
  };
  return [{ provide: AUI_SYNTAX_HIGHLIGHTER, useValue: highlighter }];
}
