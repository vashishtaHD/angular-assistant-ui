import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = join(__dirname, '..');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'testing-internal' ? [] : sourceFiles(path);
    return /\.ts$/.test(name) && !/\.(spec|d)\.ts$/.test(name) && !name.startsWith('test-setup')
      ? [path]
      : [];
  });

const BARREL = /(import|export)\s+(type\s+)?([^;]*?)\s*from\s*['"]@assistant-ui\/core\/react['"]/gs;

/** Statements that load `@assistant-ui/core/react` at runtime (not type-only). */
const BARE = /import\s*['"]@assistant-ui\/core\/react['"]/g;

const runtimeBarrelImports = (source: string): string[] => [
  ...[...source.matchAll(BARE)].map(([statement]) => statement),
  ...[...source.matchAll(BARREL)]
    .filter(([, , typeOnly, clause]) => {
      if (typeOnly) return false;
      const specifiers = clause!
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return specifiers.length === 0 || specifiers.some((s) => !s.startsWith('type '));
    })
    .map(([statement]) => statement),
];

describe('main entry stays free of the React barrel', () => {
  it('detects value imports and ignores type-only ones', () => {
    expect(runtimeBarrelImports(`import { Tools } from '@assistant-ui/core/react';`)).toHaveLength(
      1,
    );
    expect(
      runtimeBarrelImports(`export { type A, B } from '@assistant-ui/core/react';`),
    ).toHaveLength(1);
    expect(runtimeBarrelImports(`import '@assistant-ui/core/react';`)).toHaveLength(1);
    expect(runtimeBarrelImports(`import type { A } from '@assistant-ui/core/react';`)).toHaveLength(
      0,
    );
    expect(
      runtimeBarrelImports(`export { type A, type B } from '@assistant-ui/core/react';`),
    ).toHaveLength(0);
  });

  it('has no runtime import of @assistant-ui/core/react in any library source', () => {
    const offenders = sourceFiles(srcRoot).flatMap((file) =>
      runtimeBarrelImports(readFileSync(file, 'utf8')).map((statement) => `${file}: ${statement}`),
    );
    expect(offenders).toEqual([]);
  });
});
