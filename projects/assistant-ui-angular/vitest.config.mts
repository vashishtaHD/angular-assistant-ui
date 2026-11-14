import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

// `react` resolves to tap's standalone shim so the store/core packages run
// without React (same approach as upstream's Vue package). The jsx runtimes
// are needed by `@assistant-ui/core/react` (specs import `Tools` from it).
const reactAliases = [
  {
    find: /^react\/jsx-runtime$/,
    replacement: '@assistant-ui/tap/standalone-shim/jsx-runtime',
  },
  {
    find: /^react\/jsx-dev-runtime$/,
    replacement: '@assistant-ui/tap/standalone-shim/jsx-dev-runtime',
  },
  {
    find: /^react\/compiler-runtime$/,
    replacement: '@assistant-ui/tap/standalone-shim/compiler-runtime',
  },
  { find: /^react$/, replacement: '@assistant-ui/tap/standalone-shim' },
];

function project(name: 'zone' | 'zoneless') {
  return {
    plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
    resolve: { alias: reactAliases },
    test: {
      name,
      globals: true,
      environment: 'jsdom',
      setupFiles: [`src/test-setup.${name}.ts`],
      include: ['src/**/*.spec.ts', 'testing/**/*.spec.ts', 'ui/**/*.spec.ts'],
      // Inline so the react aliases also apply inside @assistant-ui/* packages.
      server: { deps: { inline: [/@assistant-ui\//] } },
    },
  };
}

export default defineConfig({
  test: {
    projects: [project('zone'), project('zoneless')],
  },
});
