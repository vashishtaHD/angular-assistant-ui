#!/usr/bin/env node
// Original (no upstream counterpart). Build-output check for the declared `react` peer range
// (^18 || ^19): no published FESM may import an API that React 18 lacks straight from `react`.
// The library takes such hooks from `@assistant-ui/tap/react-shim`, which falls back on React 18,
// as the published `@assistant-ui/ai-sdk` does. Run after `npm run build:lib`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** React exports that React 18 (or React 19.0/19.1) does not have. */
export const REACT_19_ONLY = [
  'useEffectEvent',
  'use',
  'useActionState',
  'useOptimistic',
  'useFormStatus',
  'Activity',
  'ViewTransition',
  'addTransitionType',
  'cache',
  'cacheSignal',
  'captureOwnerStack',
  'unstable_useCacheRefresh',
];

const IMPORT =
  /import\s*(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}|\*\s+as\s+[\w$]+)?\s*from\s*['"]react['"]/g;

/**
 * Lists the React-19-only names `code` imports from `react` itself (named imports), plus
 * `*` for a namespace import, whose member use a bundler cannot check against React 18.
 */
export function reactCompatProblems(code) {
  const problems = [];
  for (const match of code.matchAll(IMPORT)) {
    if (/\*\s+as/.test(match[0])) problems.push('*');
    for (const spec of (match[2] ?? '').split(',')) {
      const name = spec
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (REACT_19_ONLY.includes(name)) problems.push(name);
    }
  }
  return problems;
}

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, 'dist', 'assistant-ui-angular', 'fesm2022');
  if (!existsSync(dir)) {
    console.error(`check-react-compat: ${dir} not found. Run "npm run build:lib" first.`);
    process.exit(1);
  }
  const files = readdirSync(dir).filter((name) => name.endsWith('.mjs'));
  const offenders = files.flatMap((name) =>
    reactCompatProblems(readFileSync(join(dir, name), 'utf8')).map((api) => `${name}: ${api}`),
  );
  if (offenders.length > 0) {
    console.error(
      `check-react-compat: React-19-only imports from "react" (use @assistant-ui/tap/react-shim):\n  ${offenders.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(`check-react-compat: ok (${files.length} FESM files)`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
