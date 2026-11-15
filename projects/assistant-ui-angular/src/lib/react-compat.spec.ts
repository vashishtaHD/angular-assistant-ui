// Original spec (no upstream counterpart): guards the declared `react` peer range (^18 || ^19).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const libRoot = join(__dirname, '..', '..');
const ENTRIES = ['src', 'mastra/src', 'react-interop/src', 'testing/src', 'ui/src', 'markdown/src'];

/** React exports that React 18 (or React 19.0/19.1) does not have. */
const REACT_19_ONLY = new Set([
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
]);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'testing-internal' ? [] : sourceFiles(path);
    return /\.ts$/.test(name) &&
      !/\.(spec|test|d)\.ts$/.test(name) &&
      !name.startsWith('test-setup')
      ? [path]
      : [];
  });

/**
 * The value bindings a source imports from `react` itself (`import { a }`, `import * as R`,
 * `import R`). Type-only specifiers are erased and ignored.
 */
export const reactValueImports = (source: string): string[] => {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  for (const node of file.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteralLike(node.moduleSpecifier) ||
      node.moduleSpecifier.text !== 'react'
    ) {
      continue;
    }
    const clause = node.importClause;
    if (!clause) {
      names.push('<side effect>');
      continue;
    }
    if (clause.isTypeOnly) continue;
    if (clause.name) names.push('default');
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) names.push('*');
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) names.push((element.propertyName ?? element.name).text);
      }
    }
  }
  return names;
};

describe('react peer range', () => {
  it('detects value imports and ignores type-only ones', () => {
    expect(reactValueImports(`import { useEffectEvent, type FC } from 'react';`)).toEqual([
      'useEffectEvent',
    ]);
    expect(reactValueImports(`import { useEffectEvent as e } from 'react';`)).toEqual([
      'useEffectEvent',
    ]);
    expect(reactValueImports(`import * as R from 'react';`)).toEqual(['*']);
    expect(reactValueImports(`import type { FC } from 'react';`)).toEqual([]);
    expect(reactValueImports(`import { useState } from '@assistant-ui/tap/react-shim';`)).toEqual(
      [],
    );
  });

  it('no library source imports a React-19-only API from react', () => {
    const offenders = ENTRIES.flatMap((entry) =>
      sourceFiles(join(libRoot, entry)).flatMap((file) =>
        reactValueImports(readFileSync(file, 'utf8'))
          .filter((name) => REACT_19_ONLY.has(name) || name === '*' || name === 'default')
          .map((name) => `${relative(libRoot, file)}: ${name}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('the mastra entry takes every React hook from tap react-shim, as @assistant-ui/ai-sdk does', () => {
    // The shim runs tap hooks inside a resource and falls back (useEffectEvent on React 18).
    const offenders = sourceFiles(join(libRoot, 'mastra/src')).flatMap((file) =>
      reactValueImports(readFileSync(file, 'utf8')).map(
        (name) => `${relative(libRoot, file)}: ${name}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
