import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('styles.css', () => {
  const css = readFileSync(join(__dirname, 'styles.css'), 'utf8');

  it('blocks document scroll behind modals (CDK block scroll strategy)', () => {
    expect(css).toMatch(/\.cdk-global-scrollblock\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.cdk-global-scrollblock\s*\{[^}]*overflow-y:\s*scroll/);
  });
});
