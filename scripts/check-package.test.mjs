// Original (no upstream counterpart): tests for scripts/check-package.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REQUIRED_FILES, checkPackage, hasSideEffects } from './check-package.mjs';

const manifest = {
  name: 'angular-assistant-ui',
  version: '0.1.0',
  license: 'MIT',
  author: 'Someone',
  sideEffects: ['*.css', '**/*.css'],
  publishConfig: { access: 'public', provenance: true },
  exports: { './ui/styles.css': './ui/styles.css' },
};
const files = [...REQUIRED_FILES, 'fesm2022/angular-assistant-ui.mjs.map', 'ui/index.d.ts'];
const check = (overrides = {}) =>
  checkPackage({ files, manifest, expectedVersion: '0.1.0', ...overrides });

test('a complete package passes', () => {
  assert.deepEqual(check(), []);
});

test('sideEffects globs match the way bundlers read them', () => {
  assert.equal(hasSideEffects(['*.css'], 'ui/styles.css'), true);
  assert.equal(hasSideEffects(['**/*.css'], './ui/styles.css'), true);
  assert.equal(hasSideEffects(['ui/*.css'], 'ui/styles.css'), true);
  assert.equal(hasSideEffects(['./*.css'], 'ui/styles.css'), false);
  assert.equal(hasSideEffects(['*.css'], 'fesm2022/angular-assistant-ui.mjs'), false);
  assert.equal(hasSideEffects(false, 'ui/styles.css'), false);
  assert.equal(hasSideEffects(undefined, 'ui/styles.css'), true);
});

test('sideEffects: false would drop the stylesheet', () => {
  const problems = check({ manifest: { ...manifest, sideEffects: false } });
  assert.ok(problems.some((p) => p.includes('drop ui/styles.css')));
});

test('sideEffects: true would keep every bundle', () => {
  const problems = check({ manifest: { ...manifest, sideEffects: true } });
  assert.ok(problems.some((p) => p.includes('fesm2022/angular-assistant-ui.mjs')));
});

test('missing files are reported', () => {
  const problems = check({ files: files.filter((f) => f !== 'NOTICE' && f !== 'ui/styles.css') });
  assert.deepEqual(problems, ['missing NOTICE', 'missing ui/styles.css']);
});

test('stray files are reported', () => {
  const stray = ['lib/a.spec.d.ts', '.env', 'src/x.ts', 'tsconfig.lib.json', 'esm2022/x.mjs.map'];
  const problems = check({ files: [...files, ...stray] });
  for (const file of stray)
    assert.ok(
      problems.some((p) => p.includes(file)),
      file,
    );
});

// The address is assembled at run time so no file in the repository contains one.
test('manifest problems are reported', () => {
  const problems = check({
    manifest: {
      ...manifest,
      private: true,
      author: `A <${['a', 'example.com'].join('@')}>`,
      publishConfig: {},
    },
    expectedVersion: '0.2.0',
  });
  assert.deepEqual(problems, [
    'version is 0.1.0, expected 0.2.0',
    'package.json is private',
    'publishConfig.access is not public',
    'publishConfig.provenance is not true',
    'package.json contains an email address',
  ]);
});
