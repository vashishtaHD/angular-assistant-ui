import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

const lib = (path: string) => fileURLToPath(new URL(path, import.meta.url));

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

// Secondary entries import the main entry by its package name; resolve it to
// the sources so specs do not depend on `npm run build:lib`.
const entryAliases = [
  { find: /^angular-assistant-ui$/, replacement: lib('src/public-api.ts') },
  { find: /^angular-assistant-ui\/markdown$/, replacement: lib('markdown/src/public-api.ts') },
  { find: /^angular-assistant-ui\/shiki$/, replacement: lib('shiki/src/public-api.ts') },
];

function project(name: 'zone' | 'zoneless') {
  return {
    plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
    resolve: { alias: [...reactAliases, ...entryAliases] },
    test: {
      name,
      globals: true,
      environment: 'jsdom',
      setupFiles: [`src/test-setup.${name}.ts`],
      include: [
        'src/**/*.spec.ts',
        'testing/**/*.spec.ts',
        'ui/**/*.spec.ts',
        'mastra/**/*.spec.ts',
        'markdown/**/*.spec.ts',
        'shiki/**/*.spec.ts',
        'markdown/src/vendor/**/*.test.ts',
      ],
      // Inline so the react aliases also apply inside @assistant-ui/* packages
      // and @ai-sdk/react (the mastra entry runs `useChat` through the shim).
      server: { deps: { inline: [/@assistant-ui\//, /@ai-sdk\/react/] } },
    },
  };
}

export default defineConfig({
  test: {
    projects: [project('zone'), project('zoneless')],
  },
});
