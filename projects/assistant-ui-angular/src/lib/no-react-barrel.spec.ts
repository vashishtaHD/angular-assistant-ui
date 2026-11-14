import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const srcRoot = join(__dirname, '..');
const BARREL = '@assistant-ui/core/react';

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'testing-internal' ? [] : sourceFiles(path);
    return /\.ts$/.test(name) && !/\.(spec|d)\.ts$/.test(name) && !name.startsWith('test-setup')
      ? [path]
      : [];
  });

const isBarrel = (node: ts.Expression | undefined): boolean =>
  !!node && ts.isStringLiteralLike(node) && node.text === BARREL;

/**
 * Statements that load `@assistant-ui/core/react` at runtime: value imports
 * and re-exports, bare imports, `import x = require()` and dynamic `import()`.
 * Type-only declarations (or declarations whose specifiers are all type-only)
 * are erased and therefore allowed.
 */
const runtimeBarrelImports = (source: string): string[] => {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && isBarrel(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const typeOnly =
        !!clause &&
        (clause.isTypeOnly ||
          (!clause.name &&
            !!named &&
            ts.isNamedImports(named) &&
            named.elements.length > 0 &&
            named.elements.every((element) => element.isTypeOnly)));
      if (!typeOnly) found.push(node.getText(file));
    } else if (ts.isExportDeclaration(node) && isBarrel(node.moduleSpecifier)) {
      const named = node.exportClause;
      const typeOnly =
        node.isTypeOnly ||
        (!!named &&
          ts.isNamedExports(named) &&
          named.elements.length > 0 &&
          named.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) found.push(node.getText(file));
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      isBarrel(node.moduleReference.expression) &&
      !node.isTypeOnly
    ) {
      found.push(node.getText(file));
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      isBarrel(node.arguments[0])
    ) {
      found.push(node.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

describe('main entry stays free of the React barrel', () => {
  it('detects every kind of runtime import', () => {
    const detect = (code: string) => runtimeBarrelImports(code).length;
    expect(detect(`import { Tools } from '${BARREL}';`)).toBe(1);
    expect(detect(`import * as R from '${BARREL}';`)).toBe(1);
    expect(detect(`import Tools from '${BARREL}';`)).toBe(1);
    expect(detect(`import '${BARREL}';`)).toBe(1);
    expect(detect(`export { type A, B } from '${BARREL}';`)).toBe(1);
    expect(detect(`export * from '${BARREL}';`)).toBe(1);
    expect(detect(`const m = await import('${BARREL}');`)).toBe(1);
    expect(detect(`import R = require('${BARREL}');`)).toBe(1);
  });

  it('ignores type-only imports and is not fooled by comments', () => {
    const detect = (code: string) => runtimeBarrelImports(code).length;
    expect(detect(`import type { A } from '${BARREL}';`)).toBe(0);
    expect(detect(`import { type A, type B } from '${BARREL}';`)).toBe(0);
    expect(detect(`export type { A } from '${BARREL}';`)).toBe(0);
    expect(detect(`export { type A } from '${BARREL}';`)).toBe(0);
    expect(detect(`// import the types\nimport type { A } from '${BARREL}';`)).toBe(0);
    // A comment that mentions `import type` must not hide a value import.
    expect(detect(`// We import type helpers below\nimport { Tools } from '${BARREL}';`)).toBe(1);
    expect(detect(`// import('${BARREL}') is documented here`)).toBe(0);
  });

  it('has no runtime import of @assistant-ui/core/react in any library source', () => {
    const offenders = sourceFiles(srcRoot).flatMap((file) =>
      runtimeBarrelImports(readFileSync(file, 'utf8')).map((statement) => `${file}: ${statement}`),
    );
    expect(offenders).toEqual([]);
  });
});
