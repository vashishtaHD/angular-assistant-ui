#!/usr/bin/env node
// Original (no upstream counterpart): type-checks the TypeScript samples in the READMEs against
// the built library. Run after `npm run build:lib`.
//
// Every ```ts block of README.md and projects/assistant-ui-angular/README.md becomes its own module
// in a temporary directory, which the Angular compiler (ngc, with strictTemplates, so component
// templates are checked too) compiles against dist/assistant-ui-angular. The directory is deleted
// afterwards. Put `<!-- readme-sample: skip -->` on the line before a block to leave it out.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const READMES = ['README.md', 'projects/assistant-ui-angular/README.md'];
const ENTRIES = ['markdown', 'mastra', 'react-interop', 'shiki', 'testing', 'ui'];
const SKIP = '<!-- readme-sample: skip -->';

/** Returns the ```ts / ```typescript blocks of a markdown file with their 1-based start line. */
export function extractTsSamples(markdown) {
  const lines = markdown.split(/\r?\n/);
  const samples = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)```(ts|typescript)\s*$/.exec(lines[i]);
    if (!open) continue;
    const end = lines.findIndex((line, j) => j > i && /^\s*```\s*$/.test(line));
    if (end === -1) throw new Error(`unclosed code block at line ${i + 1}`);
    let previous = i - 1;
    while (previous >= 0 && lines[previous].trim() === '') previous--;
    const skip = previous >= 0 && lines[previous].trim() === SKIP;
    if (!skip) {
      const indent = open[1].length;
      const code = lines
        .slice(i + 1, end)
        .map((line) => line.slice(Math.min(indent, line.length - line.trimStart().length)))
        .join('\n');
      samples.push({ line: i + 1, code });
    }
    i = end;
  }
  return samples;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dist = join(root, 'dist', 'assistant-ui-angular');
  if (!existsSync(join(dist, 'index.d.ts'))) {
    console.error(`check-readme-samples: ${dist} not found. Run "npm run build:lib" first.`);
    process.exit(1);
  }
  // Inside node_modules so the samples resolve the workspace's packages; never committed.
  const work = join(root, 'node_modules', '.cache', 'readme-samples');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  const files = [];
  const origin = new Map();
  for (const readme of READMES) {
    const samples = extractTsSamples(readFileSync(join(root, readme), 'utf8'));
    for (const { line, code } of samples) {
      const name = `${readme.replace(/[/\\.]/g, '_')}_L${line}.ts`;
      // `export {}` makes every sample a module, so samples may reuse names.
      writeFileSync(join(work, name), `${code}\nexport {};\n`);
      files.push(name);
      origin.set(name, `${readme}#L${line}`);
    }
  }

  const paths = { 'angular-assistant-ui': [dist] };
  for (const entry of ENTRIES) paths[`angular-assistant-ui/${entry}`] = [join(dist, entry)];
  writeFileSync(
    join(work, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: relative(work, join(root, 'tsconfig.json')).replace(/\\/g, '/'),
        compilerOptions: { noEmit: true, paths, sourceMap: false },
        files,
        angularCompilerOptions: { strictTemplates: true },
      },
      null,
      2,
    ),
  );

  const ngc = join(
    root,
    'node_modules',
    '@angular',
    'compiler-cli',
    'bundles',
    'src',
    'bin',
    'ngc.js',
  );
  const result = spawnSync(process.execPath, [ngc, '-p', join(work, 'tsconfig.json')], {
    cwd: root,
    encoding: 'utf8',
  });
  rmSync(work, { recursive: true, force: true });

  // Strip colours, then name each sample by its README and line.
  const output = `${result.stdout}${result.stderr}`
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/[\w.-]*README_md_L\d+\.ts/g, (name) => origin.get(name) ?? name);
  if (result.status !== 0) {
    console.error(output.trim());
    console.error(`check-readme-samples: ${files.length} samples, type errors above`);
    process.exit(1);
  }
  console.log(`check-readme-samples: ok (${files.length} samples in ${READMES.join(', ')})`);
}
