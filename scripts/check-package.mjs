#!/usr/bin/env node
// Original (no upstream counterpart): checks the library tarball exactly as `npm publish` would
// pack it. Run after `npm run build:lib`. It lists the files with `npm pack --dry-run --json`
// and fails when a required file is missing, a stray file is packed (specs, TypeScript sources,
// `.env`, configs, source maps outside fesm2022), or the manifest is wrong: the version, a
// `private` flag, `publishConfig`, an email address, or a `sideEffects` value that would let a
// bundler drop `import 'angular-assistant-ui/ui/styles.css'`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SECONDARY_ENTRIES = ['markdown', 'mastra', 'react-interop', 'shiki', 'testing', 'ui'];

export const REQUIRED_FILES = [
  'README.md',
  'LICENSE',
  'NOTICE',
  'package.json',
  'index.d.ts',
  'fesm2022/angular-assistant-ui.mjs',
  'ui/styles.css',
  ...SECONDARY_ENTRIES.flatMap((entry) => [
    `${entry}/index.d.ts`,
    `fesm2022/angular-assistant-ui-${entry}.mjs`,
  ]),
];

/** Patterns no packed file may match, with the reason. */
const FORBIDDEN = [
  [/\.(spec|test)(\.d)?\.[cm]?[jt]s$/, 'a spec file'],
  [/(^|\/)\.env(\.|$)/, 'an environment file'],
  [/(?<!\.d)\.ts$/, 'a TypeScript source (only .d.ts is published)'],
  [/(^|\/)(tsconfig[^/]*\.json|ng-package\.json|vitest\.config\.[cm]?[jt]s)$/, 'a build config'],
  [/(^|\/)node_modules\//, 'a node_modules file'],
  [/\.tgz$/, 'a tarball'],
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/**
 * Converts one `sideEffects` glob to a RegExp the way webpack and esbuild read it: a pattern with
 * no `/` matches the file name in any directory, `**` spans directories and `*` stays inside one.
 */
export function sideEffectsPatternToRegExp(pattern) {
  let glob = pattern.replace(/^\.\//, '');
  if (!pattern.includes('/')) glob = `**/${glob}`;
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      // `**/` is zero or more directories; a trailing `**` is anything.
      if (glob[i + 2] === '/') {
        source += '(?:.*/)?';
        i += 2;
      } else {
        source += '.*';
        i += 1;
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

/** Whether a bundler keeps `file` (a path inside the package) as having side effects. */
export function hasSideEffects(sideEffects, file) {
  if (sideEffects === undefined || sideEffects === true) return true;
  if (sideEffects === false) return false;
  if (!Array.isArray(sideEffects)) return true;
  const path = file.replace(/^\.\//, '');
  return sideEffects.some((pattern) => sideEffectsPatternToRegExp(pattern).test(path));
}

/**
 * Returns the problems with a packed file list and its manifest (empty when it is publishable).
 * `expectedVersion` is the library source package.json version.
 */
export function checkPackage({ files, manifest, expectedVersion }) {
  const problems = [];
  const packed = new Set(files);
  for (const file of REQUIRED_FILES) {
    if (!packed.has(file)) problems.push(`missing ${file}`);
  }
  for (const file of files) {
    for (const [pattern, what] of FORBIDDEN) {
      if (pattern.test(file)) problems.push(`stray file ${file} (${what})`);
    }
    // ng-packagr's FESM source maps are part of the Angular Package Format; nothing else ships one.
    if (file.endsWith('.map') && !/^fesm2022\/[^/]+\.mjs\.map$/.test(file)) {
      problems.push(`stray source map ${file}`);
    }
  }

  if (manifest.name !== 'angular-assistant-ui') problems.push(`name is ${manifest.name}`);
  if (manifest.version !== expectedVersion) {
    problems.push(`version is ${manifest.version}, expected ${expectedVersion}`);
  }
  if (manifest.private) problems.push('package.json is private');
  if (manifest.license !== 'MIT') problems.push(`license is ${manifest.license}`);
  if (manifest.publishConfig?.access !== 'public')
    problems.push('publishConfig.access is not public');
  if (manifest.publishConfig?.provenance !== true)
    problems.push('publishConfig.provenance is not true');
  if (manifest.scripts) problems.push('package.json has scripts');
  if (EMAIL.test(JSON.stringify(manifest))) problems.push('package.json contains an email address');

  const css = files.filter((file) => file.endsWith('.css'));
  for (const file of css) {
    if (!hasSideEffects(manifest.sideEffects, file)) {
      problems.push(
        `sideEffects ${JSON.stringify(manifest.sideEffects)} lets a bundler drop ${file}`,
      );
    }
  }
  // The JavaScript stays side-effect free so unused primitives tree-shake.
  for (const file of files.filter((file) => file.endsWith('.mjs'))) {
    if (hasSideEffects(manifest.sideEffects, file)) {
      problems.push(`sideEffects marks ${file} as having side effects`);
    }
  }
  if (manifest.exports?.['./ui/styles.css'] !== './ui/styles.css') {
    problems.push('exports does not map ./ui/styles.css');
  }
  return problems;
}

/** Packs `dir` with `npm pack --dry-run --json` and returns the packed file paths. */
function packedFiles(dir) {
  const npmCli = process.env.npm_execpath?.endsWith('.js')
    ? process.env.npm_execpath
    : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const result = existsSync(npmCli)
    ? spawnSync(process.execPath, [npmCli, 'pack', dir, '--dry-run', '--json'], {
        encoding: 'utf8',
      })
    : spawnSync('npm', ['pack', dir, '--dry-run', '--json'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed: ${result.stderr || result.error}`);
  }
  const [pack] = JSON.parse(result.stdout);
  return pack.files.map((file) => file.path.replace(/\\/g, '/'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dist = join(root, 'dist', 'assistant-ui-angular');
  if (!existsSync(join(dist, 'package.json'))) {
    console.error(`check-package: ${dist} not found. Run "npm run build:lib" first.`);
    process.exit(1);
  }
  const files = packedFiles(dist);
  const manifest = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8'));
  const expectedVersion = JSON.parse(
    readFileSync(join(root, 'projects', 'assistant-ui-angular', 'package.json'), 'utf8'),
  ).version;
  const problems = checkPackage({ files, manifest, expectedVersion });
  if (problems.length > 0) {
    console.error('check-package: the packed tarball is not publishable:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(
    `check-package: ok (angular-assistant-ui@${manifest.version}, ${files.length} files; ` +
      `ui/styles.css kept by sideEffects ${JSON.stringify(manifest.sideEffects)})`,
  );
}
