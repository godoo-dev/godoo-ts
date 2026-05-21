/**
 * Placeholder helpers for integration tests.
 *
 * TODO(CORE-03): Phase 02-03 replaces these stubs with real implementations
 * that drive `@godoo/testcontainers` for Odoo + Postgres container lifecycle.
 * For Phase 02-01 these are stubs only — the integration test files that
 * import them are wrapped in `describe.skip(...)` and never execute, but the
 * imports still need to resolve at module-load time under `pnpm test`.
 *
 * The signatures accept `unknown` for the client/moduleManager argument so
 * every integration test's call-site typechecks regardless of which concrete
 * type it passes today. Plan 02-03 will tighten this to the real signatures.
 */

export async function installModuleForTest(
  _moduleManager: unknown,
  _moduleName: string,
  _installedModules?: string[],
): Promise<void> {
  throw new Error('installModuleForTest stub — wire @godoo/testcontainers in Plan 02-03 (CORE-03)');
}

export async function cleanupInstalledModules(
  _moduleManager: unknown,
  _installedModules: string[],
): Promise<void> {
  // No-op in stub form.
}
