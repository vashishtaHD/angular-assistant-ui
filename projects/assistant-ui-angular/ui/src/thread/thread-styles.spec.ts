import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('styles.css (Task 16 block)', () => {
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const block = (() => {
    const start = css.indexOf('/* Task 16: styled thread */');
    const end = css.indexOf('/* end Task 16 */');
    return start === -1 || end === -1 ? '' : css.slice(start, end);
  })();
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[},\\s])${escaped}\\s*(,[^{]*)?\\{([^}]*)\\}`, 'm');
  };

  it('lives in its own delimited block', () => {
    expect(block).not.toBe('');
  });

  it('sets color-scheme so light-dark() colours follow the theme', () => {
    expect(block).toMatch(rule('.aui-root'));
    expect(block.match(rule('.aui-root'))?.[3]).toMatch(/color-scheme:\s*light dark/);
    expect(block.match(rule('.aui-dark'))?.[3]).toMatch(/color-scheme:\s*dark/);
    expect(block.match(rule('.aui-light'))?.[3]).toMatch(/color-scheme:\s*light/);
  });

  it('styles a highlighted code block like the plain one', () => {
    const plain = block.match(rule('.aui-md-pre'))?.[0] ?? '';
    expect(plain).toMatch(/\.aui-md-code-highlighted pre/);
    expect(plain).toMatch(/padding:/);
    expect(plain).toMatch(/border-radius:/);
    expect(plain).toMatch(/overflow-x:\s*auto/);
  });

  it('keeps the hidden attribute effective on flex containers', () => {
    expect(block).toMatch(/\.aui-root \[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  });
});
