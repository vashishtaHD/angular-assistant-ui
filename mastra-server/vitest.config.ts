import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 30000,
    env: {
      MASTRA_AUTH_MODE: 'dev',
      MASTRA_DEV_AUTH: '1',
      MASTRA_DB_URL: ':memory:',
    },
  },
});
