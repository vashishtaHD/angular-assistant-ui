import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

const lib = (path: string) =>
  fileURLToPath(new URL(`../assistant-ui-angular/${path}`, import.meta.url));

// The demo runs with the real `react` package (as in its browser build):
// `@assistant-ui/tap` drives React's hooks through its own dispatcher, so no
// React renderer is involved. The library resolves to its sources so the
// specs do not depend on `npm run build:lib`.
export default defineConfig({
  plugins: [angular({ tsconfig: 'tsconfig.spec.json' })],
  resolve: {
    alias: [
      { find: /^angular-assistant-ui\/testing$/, replacement: lib('testing/src/public-api.ts') },
      { find: /^angular-assistant-ui$/, replacement: lib('src/public-api.ts') },
    ],
  },
  test: {
    name: 'demo',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
});
