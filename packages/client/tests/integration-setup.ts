/**
 * Vitest globalSetup for `@godoo/client` integration tests (Plan 02-03).
 *
 * Starts a single Odoo + Postgres container pair via `@godoo/testcontainers`
 * before any `*.integration.test.ts` file runs and tears it down afterwards.
 * Test files read connection info from `process.env.ODOO_*` — this module is
 * the single source of truth for those values; do NOT mutate them elsewhere.
 *
 * Env-var contract (verified by grep of all 10 integration test files at
 * Plan 02-03 Task 1 — see SUMMARY env-var enumeration table):
 *   - ODOO_URL          — 10/10 files
 *   - ODOO_DB_NAME      — 9/10 files (every file except examples.integration.test.ts)
 *   - ODOO_DB_USER      — 9/10 files
 *   - ODOO_DB_PASSWORD  — 9/10 files
 *   - ODOO_DB           — examples.integration.test.ts only
 *   - ODOO_USER         — examples.integration.test.ts only
 *   - ODOO_PASSWORD     — examples.integration.test.ts only
 *
 * Container orchestration is entirely owned by `@godoo/testcontainers` (Phase-2
 * D-05): no `services:` block in CI, no docker-compose.test.yml. The vitest
 * `pool: 'forks'` + `fileParallelism: false` config in
 * `packages/client/vitest.integration.config.ts` ensures all integration files
 * share this one container — running them in parallel would race for the same
 * Postgres database.
 *
 * Per CLAUDE.md secrets-handling rule and the no-credential-logging convention
 * carried over from `odoo-toolbox`, this file MUST NOT log credential values.
 * The defaults are the test-container `admin/admin` literals — not real
 * secrets — but the pattern matters: a real secret should never end up in a
 * session transcript.
 */

import { type StartedOdooContainer, startOdoo } from '@godoo/testcontainers';

let odoo: StartedOdooContainer | undefined;

export async function setup(): Promise<void> {
  odoo = await startOdoo({ modules: ['base', 'mail', 'crm'] });

  // Canonical env-var contract (used by 9 of 10 integration files).
  process.env.ODOO_URL = odoo.url;
  process.env.ODOO_DB_NAME = odoo.database;
  process.env.ODOO_DB_USER = 'admin';
  process.env.ODOO_DB_PASSWORD = 'admin';

  // Alternative names read by examples.integration.test.ts only.
  process.env.ODOO_DB = odoo.database;
  process.env.ODOO_USER = 'admin';
  process.env.ODOO_PASSWORD = 'admin';
}

export async function teardown(): Promise<void> {
  await odoo?.cleanup();
  odoo = undefined;
}
