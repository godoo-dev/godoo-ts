import { defineConfig } from 'vitest/config';

/**
 * Per-package vitest config for `@godoo-dev/client` UNIT tests.
 *
 * Mirrors the pattern Wave 2 introduced in `packages/testcontainers/vitest.config.ts`:
 * the root `vitest.config.ts` has `projects: ['packages/*']` which treats per-package
 * configs as project overrides — those overrides REPLACE the root `test.exclude`
 * rather than extending it. Without restating the integration-test exclude here,
 * `pnpm test` from the workspace root discovers `tests/**\/*.integration.test.ts`
 * once Plan 02-03 removes the `describe.skip` wrappers, and the integration tests
 * try to reach a non-existent Odoo container under the unit-test runner.
 *
 * The opt-in integration runner uses `vitest.integration.config.ts` (consumed by
 * the `test:integration` script) — that config narrows `include` to integration
 * files only, so the two configs are non-overlapping by design.
 */
export default defineConfig({
  test: {
    exclude: ['**/*.integration.test.ts', '**/node_modules/**', '**/dist/**'],
  },
});
