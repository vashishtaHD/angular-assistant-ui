#!/usr/bin/env node
// Parity gate: every row of the parity tables in docs/porting.md (the "## Parity table"
// section, up to the next "## " heading) must be `ported` or `n/a (<reason>)`. Any row
// that mentions `planned`, has an empty status, `n/a` without a non-blank reason or any
// other status fails the check.
//
// The file is parsed with markdown-it (GFM tables), so the rows and cells checked are the
// ones a renderer shows: escaped pipes stay inside their cell, rows without outer pipes
// still belong to their table. Raw HTML in the section is rejected, since its tables
// would not be checked.
//
//   node scripts/check-parity.mjs [path/to/porting.md]
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const STATUS_HEADERS = ['angular status', 'status'];
const md = new MarkdownIt({ html: true });

/** Why `status` is not an accepted parity status, or null when it is. */
function statusProblem(status) {
  if (/\bplanned\b/i.test(status)) return 'is planned';
  if (/^ported\b/.test(status)) return null;
  // A non-blank reason inside a closed paren: `n/a (voice` without `)` fails.
  if (/^n\/a \(\s*[^\s)][^)]*\)/.test(status)) return null;
  if (status === '') return 'has no status';
  if (/^n\/a\b/.test(status)) return 'is n/a without a reason';
  return 'is neither `ported` nor `n/a (<reason>)`';
}

/** The h2 heading text that starts at token `index`, or null. */
const h2At = (tokens, index) =>
  tokens[index].type === 'heading_open' && tokens[index].tag === 'h2'
    ? tokens[index + 1].content.trim()
    : null;

/**
 * Checks the parity section of a porting.md text.
 * @param {string} markdown
 * @returns {{ rows: number, errors: string[] }}
 */
export function checkParity(markdown) {
  const tokens = md.parse(markdown, {});
  const start = tokens.findIndex((_, index) => h2At(tokens, index) === 'Parity table');
  if (start === -1) return { rows: 0, errors: ['no "## Parity table" section found'] };
  let end = tokens.findIndex((_, index) => index > start && h2At(tokens, index) !== null);
  if (end === -1) end = tokens.length;

  const errors = [];
  let rows = 0;
  let header = null;
  let statusColumn = -1;
  let row = null;
  let rowLine = 0;
  let inHead = false;
  for (let index = start + 2; index < end; index++) {
    const token = tokens[index];
    const line = (token.map?.[0] ?? 0) + 1;
    switch (token.type) {
      case 'html_block':
        errors.push(`line ${line}: raw HTML is not supported in the parity section`);
        break;
      case 'inline':
        if (row && token.children?.some((child) => child.type === 'html_inline')) {
          errors.push(`line ${rowLine}: raw HTML is not supported in a parity table cell`);
        }
        if (!row && /<\/?table\b/i.test(token.content)) {
          errors.push(`line ${line}: raw HTML is not supported in the parity section`);
        }
        // Pipe rows that did not parse as a table (for example a malformed delimiter row)
        // would otherwise go unchecked.
        if (!row && /^\s*\|.*\|\s*$/m.test(token.content)) {
          errors.push(`line ${line}: text that looks like table rows is not a valid table`);
        }
        if (row) row.push(token.content.trim());
        break;
      case 'table_open':
        header = null;
        statusColumn = -1;
        break;
      case 'thead_open':
        inHead = true;
        break;
      case 'thead_close':
        inHead = false;
        break;
      case 'tr_open':
        row = [];
        rowLine = line;
        break;
      case 'tr_close':
        if (inHead) {
          header = row.map((cell) => cell.toLowerCase());
          statusColumn = header.findIndex((cell) => STATUS_HEADERS.includes(cell));
          if (statusColumn === -1) {
            errors.push(`line ${rowLine}: parity table has no "Angular status" or "Status" column`);
          }
        } else if (statusColumn !== -1) {
          rows++;
          const status = row[statusColumn] ?? '';
          const problem = statusProblem(status);
          if (problem) {
            errors.push(`line ${rowLine}: "${row[0]}" ${problem}: ${status || '(empty)'}`);
          }
        }
        row = null;
        break;
      default:
        break;
    }
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
