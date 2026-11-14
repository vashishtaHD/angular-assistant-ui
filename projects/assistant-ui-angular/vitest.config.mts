import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

// `react` resolves to tap's standalone shim so the store/core packages run
// without React (same approach as upstream's Vue package).
const reactAliases = [
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
      include: ['src/**/*.spec.ts'],
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
