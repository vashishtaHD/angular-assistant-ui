// Original (no upstream counterpart): tests for scripts/check-readme-samples.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractTsSamples } from './check-readme-samples.mjs';

test('extracts ts and typescript blocks with their start line', () => {
  const markdown = [
    '# Title',
    '```ts',
    'const a = 1;',
    '```',
    '```bash',
    'npm test',
    '```',
    '```typescript',
    'const b = 2;',
    '```',
  ].join('\n');
  assert.deepEqual(extractTsSamples(markdown), [
    { line: 2, code: 'const a = 1;' },
    { line: 8, code: 'const b = 2;' },
  ]);
});

test('a skip marker on the line before a block leaves it out', () => {
  const markdown = ['<!-- readme-sample: skip -->', '', '```ts', 'broken(', '```'].join('\n');
  assert.deepEqual(extractTsSamples(markdown), []);
});

test('indented blocks (in list items) are dedented', () => {
  const markdown = ['- Item:', '', '  ```ts', '  const c = 3;', '    nested();', '  ```'].join(
    '\n',
  );
  assert.deepEqual(extractTsSamples(markdown), [{ line: 3, code: 'const c = 3;\n  nested();' }]);
});

test('an unclosed block throws', () => {
  assert.throws(() => extractTsSamples('```ts\nconst d = 4;'), /unclosed code block at line 1/);
});
