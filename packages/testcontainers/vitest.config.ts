import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 600_000, // 10 minutes — must exceed container startupTimeout (300s) with margin
    hookTimeout: 600_000, // 10 minutes for beforeAll/afterAll hooks
    // Defensive override: root vitest workspace `projects: ['packages/*']` may treat
    // per-package configs as project overrides that bypass the root `exclude`.
    // Restate the integration-test exclude here so `pnpm test` from root does not
    // discover integration files in this package.
    exclude: ['**/*.integration.test.ts', '**/node_modules/**', '**/dist/**'],
  },
});
