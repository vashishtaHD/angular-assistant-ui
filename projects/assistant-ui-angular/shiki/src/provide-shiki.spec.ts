import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../src/testing-internal/test-bed';
import { AUI_SYNTAX_HIGHLIGHTER } from 'angular-assistant-ui/markdown';
import { provideShikiHighlighter } from 'angular-assistant-ui/shiki';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

function inject(opts?: Parameters<typeof provideShikiHighlighter>[0]) {
  configureTestBed({ providers: [provideShikiHighlighter(opts)] });
  return TestBed.inject(AUI_SYNTAX_HIGHLIGHTER);
}

const loadTs = () =>
  createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [import('shiki/langs/typescript.mjs')],
    engine: createJavaScriptRegexEngine(),
  });

describe('provideShikiHighlighter', () => {
  it('highlights ts into dual-theme shiki markup', async () => {
    const html = await inject().highlight('const a = 1', 'ts');
    expect(html).toContain('<pre class="shiki');
    expect(html).toContain('<span style="');
    expect(html).toContain('--shiki-dark:');
    expect(html).toContain('const');
  });

  it('escapes the code', async () => {
    const html = await inject().highlight('<img src=x onerror=alert(1)>', 'html');
    expect(html).not.toContain('<img');
  });

  it('returns null for unknown or empty languages', () => {
    const h = inject();
    expect(h.highlight('x', 'definitely-not-a-language')).toBeNull();
    expect(h.highlight('x', '')).toBeNull();
  });

  it('knows aliases and is case-insensitive', async () => {
    const h = inject();
    expect(await h.highlight('echo hi', 'Shell')).toContain('shiki');
    expect(await h.highlight('const a = 1', 'typescript')).toContain('shiki');
  });

  it('only knows the configured langs', () => {
    expect(inject({ langs: ['json'] }).highlight('x', 'ts')).toBeNull();
  });

  it('creates one highlighter for concurrent first calls', async () => {
    const loadHighlighter = vi.fn(loadTs);
    const h = inject({ loadHighlighter });
    const results = await Promise.all([
      h.highlight('const a = 1', 'ts'),
      h.highlight('const b = 2', 'ts'),
      h.highlight('let c', 'ts'),
    ]);
    for (const html of results) expect(html).toContain('shiki');
    expect(loadHighlighter).toHaveBeenCalledTimes(1);
    await h.highlight('const d', 'ts');
    expect(loadHighlighter).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed load', async () => {
    const loadHighlighter = vi
      .fn<() => Promise<HighlighterCore>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(loadTs);
    const h = inject({ loadHighlighter });
    await expect(h.highlight('x', 'ts')).rejects.toThrow('boom');
    expect(await h.highlight('const a = 1', 'ts')).toContain('shiki');
  });
});
