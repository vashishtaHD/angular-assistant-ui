import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

const lib = (path: string) =>
  fileURLToPath(new URL(`../assistant-ui-angular/${path}`, import.meta.url));

// The demo runs with the real `react` package (as in its browser build):
// `@assistant-ui/tap` drives React's hooks through its own dispatcher, so no
// React renderer is involved. The `angular-assistant-ui/mastra` entry therefore
// runs `@ai-sdk/react`'s `useChat` on real React here (the library's own specs
// run it through tap's standalone shim). The library resolves to its sources so the
// specs do not depend on `npm run build:lib`.
export default defineConfig({
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
  resolve: {
    alias: [
      { find: /^angular-assistant-ui\/testing$/, replacement: lib('testing/src/public-api.ts') },
      { find: /^angular-assistant-ui\/ui$/, replacement: lib('ui/src/public-api.ts') },
      { find: /^angular-assistant-ui\/markdown$/, replacement: lib('markdown/src/public-api.ts') },
      { find: /^angular-assistant-ui\/shiki$/, replacement: lib('shiki/src/public-api.ts') },
      { find: /^angular-assistant-ui\/mastra$/, replacement: lib('mastra/src/public-api.ts') },
      { find: /^angular-assistant-ui$/, replacement: lib('src/public-api.ts') },
    ],
  },
  test: {
    name: 'demo',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    // The app specs drive whole chat turns (history loads, streams, Shiki) through the DOM.
    testTimeout: 15000,
  },
});
