#!/usr/bin/env node
// Build-output check: the `angular-assistant-ui/ui` entry ships styles.css as an asset.
// Run after `npm run build:lib`. Exits non-zero when the file is missing or looks wrong.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'dist', 'assistant-ui-angular', 'ui', 'styles.css');

const fail = (msg) => {
  console.error(`check-ui-styles-asset: ${msg}`);
  process.exit(1);
};

if (!existsSync(file)) fail(`${file} not found. Run "npm run build:lib" first.`);
const css = readFileSync(file, 'utf8');
for (const token of ['--aui-background', '--aui-foreground', '--aui-radius', '.aui-dark']) {
  if (!css.includes(token)) fail(`${file} is missing "${token}"`);
}
console.log(`check-ui-styles-asset: ok (${file}, ${css.length} bytes)`);
