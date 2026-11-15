#!/usr/bin/env node
// Original (no upstream counterpart): prints the CHANGELOG.md section of one version, for the
// GitHub Release notes.
//
//   node scripts/release-notes.mjs <version>   (for example 0.1.0 or v0.2.0-beta.1)
//
// Fails when CHANGELOG.md has no `## [<version>]` heading or the section is empty.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Returns the body of the `## [version]` section of a Keep a Changelog file, or undefined. */
export function changelogSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^## \\[${escaped}\\]`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return undefined;
  let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  if (end === -1) end = lines.length;
  // Drop the link reference definitions Keep a Changelog puts at the end of the file.
  const body = lines
    .slice(start + 1, end)
    .filter((line) => !/^\[[^\]]+\]: \S+$/.test(line))
    .join('\n')
    .trim();
  return body || undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const version = process.argv[2]?.replace(/^v/, '');
  if (!version) {
    console.error('usage: node scripts/release-notes.mjs <version>');
    process.exit(2);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const section = changelogSection(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), version);
  if (!section) {
    console.error(`release-notes: CHANGELOG.md has no non-empty "## [${version}]" section`);
    process.exit(1);
  }
  console.log(section);
}
