import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('styles.css', () => {
  const css = readFileSync(join(__dirname, 'styles.css'), 'utf8');

  it('blocks document scroll behind modals (CDK block scroll strategy)', () => {
    expect(css).toMatch(/\.cdk-global-scrollblock\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.cdk-global-scrollblock\s*\{[^}]*overflow-y:\s*scroll/);
  });

  // Critters (Angular's critical-CSS inliner) uses css-what, which rejects a
  // :has() argument that starts with a pseudo-class ("Empty sub-selector") and
  // skips the rule with a build warning.
  it('has no :has() whose argument starts with a pseudo-class', () => {
    expect(css.match(/:has\(\s*:[^)]*\)/g) ?? []).toEqual([]);
  });

  it('highlights a thread list row and reveals its More button on focus within', () => {
    expect(css).toMatch(
      /\.aui-thread-list-item:focus-within\s*\{[^}]*background:\s*var\(--aui-muted\)/,
    );
    expect(css).toContain('.aui-thread-list-item:focus-within .aui-thread-list-item-more');
    expect(css).toContain('.aui-thread-list-item-more:focus-visible');
    expect(css).toMatch(/\.aui-thread-list-item-trigger:focus-visible\s*\{[^}]*box-shadow/);
  });
});
