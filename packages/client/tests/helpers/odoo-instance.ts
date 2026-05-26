/**
 * Test-helper utilities for integration tests that need to install / uninstall
 * Odoo modules on the live container provisioned by `tests/integration-setup.ts`.
 *
 * Plan 02-01 shipped a placeholder version of this file that threw on call so
 * the 10 `*.integration.test.ts` files would resolve at module-load time while
 * skip-wrapped. Plan 02-03 replaces the placeholders with the real
 * `ModuleManager`-driven implementations now that `@godoo-dev/testcontainers` is
 * in place and the integration tests actually run.
 *
 * Signatures stay compatible with the call sites in accounting-service,
 * attendance, and timesheets-service integration tests:
 *
 *   const installedModules: string[] = [];
 *   await installModuleForTest(client.modules, 'account', installedModules);
 *   // ... test body ...
 *   await cleanupInstalledModules(client.modules, installedModules);
 *
 * The `installedModules` array is mutated in place so the cleanup pass only
 * uninstalls modules THIS test caused to be installed (modules the snapshot or
 * a prior test already installed are left alone — Odoo container snapshot
 * caching pre-installs the `modules: ['base', 'mail', 'crm']` set from
 * integration-setup.ts).
 */

import type { ModuleManager } from '../../src/services/modules/module-manager.js';

/**
 * Install `moduleName` on the live Odoo container if it isn't already.
 *
 * Tracks newly-installed modules in `installedModules` so `cleanupInstalledModules`
 * can uninstall exactly that set in the afterAll hook. A module already present
 * in the snapshot baseline (e.g. `base`, `mail`, `crm` from the globalSetup
 * preset) is NOT pushed onto the tracking list, so cleanup leaves the baseline
 * intact.
 */
export async function installModuleForTest(
  moduleManager: ModuleManager,
  moduleName: string,
  installedModules: string[],
): Promise<void> {
  if (await moduleManager.isModuleInstalled(moduleName)) {
    return;
  }
  await moduleManager.installModule(moduleName);
  installedModules.push(moduleName);
}

/**
 * Uninstall every module THIS test installed, in reverse install order.
 *
 * Reverse order matters: a later module may depend on an earlier one, and
 * Odoo's `module.uninstall` propagates to dependents — uninstalling the
 * dependent first keeps each call narrowly scoped. Errors are swallowed so a
 * single failure in cleanup doesn't mask test results.
 *
 * The `installedModules` array is consumed (emptied) so the same helper pair
 * is safe to use across multiple suites in one process.
 */
export async function cleanupInstalledModules(
  moduleManager: ModuleManager,
  installedModules: string[],
): Promise<void> {
  while (installedModules.length > 0) {
    const moduleName = installedModules.pop();
    if (moduleName === undefined) {
      continue;
    }
    try {
      await moduleManager.uninstallModule(moduleName);
    } catch {
      // Best-effort cleanup — a single uninstall failure must not mask test
      // results or block sibling cleanups.
    }
  }
}
