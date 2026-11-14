import { defineConfig, devices } from '@playwright/test';

// Driven by scripts/compat.mjs, which serves a built compat app and passes
// its URL in COMPAT_BASE_URL and the app name (ng18, ng20, ng22) in COMPAT_APP.
const baseURL = process.env['COMPAT_BASE_URL'];
if (!baseURL) {
  throw new Error('COMPAT_BASE_URL is not set; run `npm run compat -- <app>` from the repo root.');
}
const app = process.env['COMPAT_APP'] ?? 'app';

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.spec.ts',
  outputDir: `test-results/${app}`,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: app, use: { ...devices['Desktop Chrome'] } }],
});
