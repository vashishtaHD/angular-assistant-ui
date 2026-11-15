#!/usr/bin/env node
// Parity gate: every row of the parity tables in docs/porting.md (the "## Parity table"
// section, up to the next "## " heading) must be `ported` or `n/a (<reason>)`. Any row
// that mentions `planned`, has an empty status, `n/a` without a reason or any other
// status fails the check.
//
//   node scripts/check-parity.mjs [path/to/porting.md]
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUS_HEADERS = ['angular status', 'status'];

/** Splits a markdown table row into trimmed cells (outer pipes removed). */
const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isSeparator = (line) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line.trim());

/** Why `status` is not an accepted parity status, or null when it is. */
function statusProblem(status) {
  if (/\bplanned\b/i.test(status)) return 'is planned';
  if (/^ported\b/.test(status)) return null;
  if (/^n\/a \(.+\)/.test(status)) return null;
  if (status === '') return 'has no status';
  if (/^n\/a\b/.test(status)) return 'is n/a without a reason';
  return 'is neither `ported` nor `n/a (<reason>)`';
}

/**
 * Checks the parity section of a porting.md text.
 * @param {string} markdown
 * @returns {{ rows: number, errors: string[] }}
 */
export function checkParity(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## Parity table\s*$/.test(line));
  if (start === -1) return { rows: 0, errors: ['no "## Parity table" section found'] };
  let end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  if (end === -1) end = lines.length;

  const errors = [];
  let rows = 0;
  let statusColumn = -1;
  let inTable = false;
  for (let index = start + 1; index < end; index++) {
    const line = lines[index];
    if (!line.trim().startsWith('|')) {
      inTable = false;
      continue;
    }
    if (!inTable) {
      // A header row, followed by its separator.
      inTable = true;
      const header = cells(line).map((cell) => cell.toLowerCase());
      statusColumn = header.findIndex((cell) => STATUS_HEADERS.includes(cell));
      if (statusColumn === -1) {
        errors.push(`line ${index + 1}: parity table has no "Angular status" or "Status" column`);
      }
      continue;
    }
    if (isSeparator(line) || statusColumn === -1) continue;
    rows++;
    const row = cells(line);
    const status = row[statusColumn] ?? '';
    const problem = statusProblem(status);
    if (problem) errors.push(`line ${index + 1}: "${row[0]}" ${problem}: ${status || '(empty)'}`);
  }
  if (rows === 0 && errors.length === 0) errors.push('the parity section has no table rows');
  return { rows, errors };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const file = resolve(process.argv[2] ?? join(root, 'docs', 'porting.md'));
  const { rows, errors } = checkParity(readFileSync(file, 'utf8'));
  if (errors.length > 0) {
    console.error(`check-parity: ${errors.length} problem(s) in ${file}`);
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }
  console.log(`check-parity: ok (${rows} rows, all ported or n/a with a reason)`);
}
