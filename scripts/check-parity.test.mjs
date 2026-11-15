// Tests for scripts/check-parity.mjs. Run: node --test scripts/
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkParity } from './check-parity.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-parity.mjs');

const doc = (rows, header = '| React export | Vue has it | Angular status | Task |') =>
  [
    '# Porting notes',
    '',
    'Status is `ported`, `planned (Task N)` or `n/a (<reason>)`.',
    '',
    '## Parity table',
    '',
    '### Thread',
    '',
    header,
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '## Porting the next primitive',
    '',
    '| Not | a | parity | table |',
    '| --- | --- | --- | --- |',
    '| x | y | planned (Task 1) | z |',
    '',
  ].join('\n');

test('passes when every row is ported or n/a with a reason', () => {
  const result = checkParity(
    doc([
      '| ThreadRoot | yes | ported | Task 2 |',
      '| ThreadIf | yes | ported (as `*auiIf`) |  |',
      '| Voice | no | n/a (voice out of scope) |  |',
    ]),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows, 3);
});

test('fails on a planned row', () => {
  const result = checkParity(doc(['| ThreadRoot | yes | planned (Task 9) | Task 9 |']));
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /ThreadRoot/);
  assert.match(result.errors[0], /planned/);
});

test('fails on a ported row that still plans more work', () => {
  const result = checkParity(doc(['| Testing | no | ported; extensions planned (Task 4) |  |']));
  assert.equal(result.errors.length, 1);
});

test('fails on n/a without a reason and on an unknown status', () => {
  const result = checkParity(
    doc(['| A | no | n/a |  |', '| B | no | todo |  |', '| C | no |  |  |']),
  );
  assert.equal(result.errors.length, 3);
});

test('reads the Status column of the entry-point table', () => {
  const ok = checkParity(
    doc(['| `angular-assistant-ui/ui` | `aui-thread` | ported |'], '| Entry | Exports | Status |'),
  );
  assert.deepEqual(ok.errors, []);
  const bad = checkParity(
    doc(['| `angular-assistant-ui/ui` | `aui-thread` | planned |'], '| Entry | Exports | Status |'),
  );
  assert.equal(bad.errors.length, 1);
});

test('ignores tables outside the parity section', () => {
  const result = checkParity(doc(['| A | yes | ported |  |']));
  assert.deepEqual(result.errors, []);
});

test('fails when the parity table has no rows', () => {
  const result = checkParity('# Porting notes\n\n## Parity table\n\nNothing here.\n');
  assert.equal(result.errors.length, 1);
});

test('the CLI exits non-zero on a planned row and zero on a clean file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'parity-'));
  const bad = join(dir, 'bad.md');
  const good = join(dir, 'good.md');
  writeFileSync(bad, doc(['| A | yes | planned (Task 3) | Task 3 |']));
  writeFileSync(good, doc(['| A | yes | ported | Task 3 |']));
  const failed = spawnSync(process.execPath, [script, bad], { encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /planned/);
  const passed = spawnSync(process.execPath, [script, good], { encoding: 'utf8' });
  assert.equal(passed.status, 0, passed.stderr);
});
