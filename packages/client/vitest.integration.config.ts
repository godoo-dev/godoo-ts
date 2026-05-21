import { defineConfig } from 'vitest/config';

/**
 * Per-package vitest config for `@godoo/client` integration tests
 * (Plan 02-03 / CORE-03).
 *
 * Discovery scope is narrowed to `tests/**\/*.integration.test.ts` so this
 * config is opt-in via the `test:integration` script (`vitest run --config
 * vitest.integration.config.ts`) and does NOT interfere with the workspace
 * `pnpm test` (unit) flow — that flow stays driven by the root
 * `vitest.config.ts` which excludes `**\/*.integration.test.ts`.
 *
 * Container lifecycle is handled exclusively by `./tests/integration-setup.ts`
 * via vitest's `globalSetup` hook (Phase-2 D-05: container orchestration is
 * entirely owned by `@godoo/testcontainers`; no docker-compose, no CI
 * `services:` block).
 *
 * - `testTimeout` / `hookTimeout: 600_000` — first cold Odoo init can run 3
 *   minutes; subsequent snapshot-cached starts are faster but the budget stays
 *   high so a slow CI runner doesn't flake. Matches the source-repo convention
 *   carried over by `@godoo/testcontainers`'s own vitest.config.ts.
 * - `pool: 'forks'` + `fileParallelism: false` + `sequence.concurrent: false`
 *   — every integration test file talks to the SAME Odoo container (created
 *   once in setup, torn down once in teardown). Running them in parallel would
 *   race for the same Postgres database and almost certainly deadlock the
 *   suite (RESEARCH §"Pitfall 7", threat T-02-03-03).
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.integration.test.ts'],
    globalSetup: './tests/integration-setup.ts',
    testTimeout: 600_000,
    hookTimeout: 600_000,
    sequence: { concurrent: false },
    pool: 'forks',
    fileParallelism: false,
  },
});
