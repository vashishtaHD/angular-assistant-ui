// Original (no upstream counterpart): fails when a tracked non-spec .ts source file has no
// provenance header on its first line ("Ported from ...", "Original ...", and the other forms
// below), so a ported file always names its upstream source and an original file says it has none.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOTS = ['projects/assistant-ui-angular/', 'mastra-server/src/', 'projects/demo/src/'];
const HEADER =
  /^\/\/ (Ported from |Original|Derived from |Vendored from |Angular addition \(no upstream counterpart\)|Angular counterpart of |Angular-native DI redesign of |Icon geometry copied from )/;

const files = execFileSync('git', ['ls-files', '-z', '--', '*.ts'], { encoding: 'utf8' })
  .split('\0')
  .filter((file) => file && ROOTS.some((root) => file.startsWith(root)))
  .filter((file) => !/\.(spec|test)\.ts$/.test(file));

const missing = files.filter((file) => {
  const first = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/, 1)[0];
  return !HEADER.test(first);
});

if (missing.length > 0) {
  console.error('check-headers: these files have no provenance header on their first line:');
  for (const file of missing) console.error(`  ${file}`);
  process.exit(1);
}
console.log(`check-headers: ok (${files.length} files)`);
