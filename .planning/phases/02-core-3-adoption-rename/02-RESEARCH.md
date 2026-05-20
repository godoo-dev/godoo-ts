# Phase 2: Core-3 Adoption & Rename - Research

**Researched:** 2026-05-21
**Domain:** Code-transfer adoption — three TypeScript Odoo client packages renamed under `@godoo/*`, landed on the Phase-1 pnpm + tsdown + Biome + vitest toolchain.
**Confidence:** HIGH (everything is verified by direct read of source and destination repos; no speculative library research needed.)

## Summary

The three source packages live at `C:\dev\odoo-toolbox/packages/odoo-{client,testcontainers,introspection}/`. They are small (47 / 13 / 11 source files), already vitest-native in their test code (no `jest.*` API calls anywhere), and import each other only through `@marcfargas/odoo-client` — never the other way. The two notable surprises that invalidate the obvious plan-shape are:

1. **There is no jest-API conversion work.** Despite per-package `package.json` scripts saying `"test": "jest"` and per-package devDeps listing `jest`/`ts-jest`/`@types/jest`, every test file in all three packages already imports from `'vitest'` and uses `vi.*`. The odoo-toolbox workspace root runs everything through three vitest configs (`vitest.config.mts`, `vitest.integration.config.mts`, `vitest.packaging.config.mts`); the per-package jest devDeps are dead weight. The D-02 work collapses to: delete dead devDeps + delete `"test": "jest"` lie, replace with `"test": "vitest run"`. No `jest.fn` → `vi.fn` rewrites required.

2. **CORE-03 is a real refactor, not an unskip.** Today the client's integration tests rely on a workspace-level `tests/helpers/globalSetup.ts` that directly drives `testcontainers` + `@testcontainers/postgresql`; the tests then read `process.env.ODOO_URL`. D-05 of CONTEXT.md mandates container orchestration go through `@godoo/testcontainers` — there is no equivalent globalSetup convention in godoo-ts, and no Odoo containers in the existing `_example`. The CORE-03 plan must (a) write a new globalSetup (or per-package equivalent) that uses `@godoo/testcontainers`'s `startOdoo()` / `OdooTestContainer`, (b) wire `ODOO_URL` etc. from the started container into `process.env` for the existing tests, OR rewrite the integration tests to call `startOdoo()` directly. The source repo never used `@godoo/testcontainers` for client integration tests — that wiring is genuinely new.

The `any` count in `@godoo/client` source is **~33** (28 source-file lines, mostly Odoo RPC `domain: any[]` and `args: any[]`); D-03's strict-clean rule means the rename commit is also a non-trivial typing pass on the client. Testcontainers has 2 such lines, introspection has 3 — trivial.

**Primary recommendation:** Slice the phase as the focus-area strawman suggests (02-01 client + delete _example; 02-02 testcontainers; 02-03 wire-and-reenable client integration tests + add integration CI job + update branch protection; 02-04 introspection). Strict-sequential waves per D-06. The biggest single plan is 02-01 because it absorbs (a) jest-devDep removal, (b) full toolchain conversion, (c) the substantial `any[]` → typed domain pass, AND (d) `packages/_example` deletion. Plan 02-03 needs an `integration/globalSetup.ts` invention since the source repo's approach doesn't carry over.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RPC client (HTTP/JSON-RPC to Odoo) | Library code (`@godoo/client`) | — | Pure runtime library; no UI/SSR tier exists in this repo |
| Container lifecycle for Odoo+Postgres | Test infrastructure (`@godoo/testcontainers`) | — | Wraps the `testcontainers` npm package; runs in the test process |
| Schema introspection + codegen | Library code (`@godoo/introspection`) | CLI (`dist/cli/cli.mjs` via `bin`) | Library is the primary surface; bin is a thin wrapper around `runCli()` |
| Build toolchain (tsdown → ESM `.mjs`/`.d.mts`) | Per-package config (`tsdown.config.ts`) | Root `tsconfig.base.json` | Mirrors the `_example` pattern locked in Phase 1 |
| Lint/format | Workspace root (`biome.json`) | — | One `biome.json` for the whole workspace; no per-package override |
| Unit test execution | Workspace root (`vitest.config.ts` with `projects: ['packages/*']`) | Per-package `tests/` directory | Phase-1 D-01 pattern; new packages auto-pick-up |
| Integration test execution (Docker) | New CI job + per-package or workspace globalSetup driving `@godoo/testcontainers` | — | D-04/D-05 — distinct from the unit job, gated on Docker availability |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Fresh copy + `pre-adoption-baseline` tag.** Before any adoption begins, tag `odoo-toolbox` at HEAD as `pre-adoption-baseline`. For each adopted package, plain-copy the package directory into `godoo-ts/packages/<new-name>/`. Adoption commit message: `feat(<pkg>): adopt @marcfargas/odoo-<pkg> as @godoo/<pkg> (from odoo-toolbox@<sha>)`. No `git subtree split` / `git filter-repo`. Per-file blame is **not** preserved.

**D-02 — Jest → vitest conversion is one-pass, inside the same adoption commit as the rename.** For client and introspection: remove `jest`, `ts-jest`, `@types/jest` devDeps + delete `jest.config.*`; rewrite jest API calls to `vi.*`; replace jest-global types with `import { describe, it, expect, vi } from 'vitest'`; update `test` script to `vitest run`. **No temporary dual-runner state.**
> **Important caveat surfaced during research:** the actual jest-API rewrite work is **zero** — see Jest → Vitest Conversion section below. The D-02 directive still applies in letter (remove dead jest devDeps + jest.config files + fix the `"test": "jest"` script lie), but the diff is much smaller than D-02's wording suggests.

**D-03 — Each adopted package must be strict-clean before the adoption plan completes.** Every public export has an explicit return type (`isolatedDeclarations: true`); zero `any` (Biome `noExplicitAny: error`); zero `biome-ignore` or `// @ts-nocheck` suppressions; `pnpm biome check .`, `pnpm tsc --noEmit`, `pnpm build` all exit 0 across the whole workspace after each package lands. **No follow-up cleanup plan. No per-package tsconfig/Biome relaxation.**

**D-04 — Integration CI job added in Phase 2.** Triggered per-push on `develop` and `main`, and on PRs targeting either. Node 22 + 24 matrix. Separate workflow job (e.g. `integration`) alongside the existing `ci` job. No path filtering, no nightly cron.

**D-05 — Container orchestration runs entirely through `@godoo/testcontainers`.** Integration tests call the testcontainers package, which manages Postgres + Odoo lifecycle from inside the test process. **No** `services:` block, **no** `docker-compose.test.yml`. Docker is available on `ubuntu-latest` by default.

**D-06 — Adoption order is locked:** (1) `@godoo/client` with integration tests temporarily skipped → (2) `@godoo/testcontainers` → (3) re-enable client integration tests against adopted testcontainers → (4) `@godoo/introspection`. The skip step in (1) carries inline TODO referencing CORE-03; step (3) deletes that TODO.

**D-07 — `packages/_example` is deleted in the first adoption commit (the `@godoo/client` one).**

### Claude's Discretion

- **Biome reformat pass on adopted code.** Fold into the D-03 in-flight strict-TS pass.
- **`debug` dependency handling.** All three packages depend on `debug ^4.x`. Keep per-package (pnpm dedupes via lockfile); no workspace catalog or root hoist unless dedup actually fails.
- **Cross-package workspace dependency style.** Use `workspace:*` for `@godoo/testcontainers` → `@godoo/client` and `@godoo/introspection` → `@godoo/client`.
- **CHANGELOG / version baseline** — Phase 3's call, not Phase 2's.
- **`godoo-adoption` branch on `odoo-toolbox`.** Phase 2 only tags `pre-adoption-baseline` in the source (read-only); branch creation and source-side shed commits are Phase 3.
- **Per-package package.json metadata refresh.** Update `author`, `repository.url`, `repository.directory`, `homepage` during rename to point at `godoo-dev/godoo-ts`. Bundle with each rename commit.
- **Internal vitest config layout.** Per-package `vitest.config.ts` or root `test.projects: ['packages/*']` — planner's call. Note: testcontainers source had its own `vitest.config.ts` for `testTimeout: 600_000` (10 minutes for container startup) — that override is functionally required for the integration tests in 02-02 and 02-03, so the per-package config wins for at least testcontainers and the client integration suite.

### Deferred Ideas (OUT OF SCOPE)

- **Publishing `@godoo/*` to the public npm scope** (PUB-01..02) — Phase 3.
- **Source-side removal of adopted packages from `odoo-toolbox`** (SHED-01..05) and the `godoo-adoption` branch + deprecation README on the source side — Phase 3.
- **CHANGELOG / version baseline** for the renamed packages — Phase 3.
- **Workspace catalog or root-hoist for `debug`** — only revisit if pnpm dedup fails.
- **Per-package CommonJS build override** — Phase 3 at publish time if any consumer needs it.
- **Atlas-MCP salvage from `odoo-mcp`** — Atlas-MCP-charter decision, not godoo-ts's.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | `@godoo/client` adopted+renamed from `@marcfargas/odoo-client`, unit tests pass (integration temporarily skipped) | Source Package Shapes §`@godoo/client`; Plan 02-01 |
| CORE-02 | `@godoo/testcontainers` adopted+renamed, tests pass | Source Package Shapes §`@godoo/testcontainers`; Plan 02-02 |
| CORE-03 | `@godoo/client` integration tests re-enabled against `@godoo/testcontainers` + real Odoo containers | Integration-Test Reactivation; Plan 02-03 (substantially more work than a simple unskip — see that section) |
| CORE-04 | `@godoo/introspection` adopted+renamed, tests pass | Source Package Shapes §`@godoo/introspection`; Plan 02-04 |
| CORE-05 | No `@marcfargas/odoo-*` import paths remain — all cross-package imports resolve to `@godoo/*` | Import-Path Rewrite Scope — exhaustively listed; verifier check: `git grep "@marcfargas/odoo-"` returns zero |

## Source Package Shapes

### `@marcfargas/odoo-client` → `@godoo/client`

| Property | Value |
|----------|-------|
| Current name / version | `@marcfargas/odoo-client@0.6.0` |
| Source location | `C:\dev\odoo-toolbox\packages\odoo-client\` |
| Source files (`src/`) | 47 `.ts` files, organised into `client/`, `rpc/`, `safety/`, `services/{accounting,attendance,cdc,mail,modules,properties,timesheets,urls}/`, `types/` |
| Public API surface (`src/index.ts`) | `export * from './client' \| './services' \| './rpc' \| './types' \| './safety'` — re-exports everything; top-level public classes/functions include `OdooClient`, `OAuthProxyClient`, `ModuleManager`, `createClient`, `OdooAuthError`, and service-specific functions (mail/accounting/attendance/timesheets/properties/urls/cdc) |
| Test files (`tests/`) | 22 `.ts` files: 12 unit (`*.test.ts`) + 10 integration (`*.integration.test.ts`). Total ~190 `it()`/`test()` calls |
| `package.json` `"type"` | Absent (CommonJS default — must add `"type": "module"`) |
| `package.json` scripts | `build: tsc`, `test: jest` (stale — see below), `dev: tsc --watch` |
| `package.json` exports | Absent — only old `main: dist/index.js` + `types: dist/index.d.ts` (must convert to ESM `.mjs`/`.d.mts` exports map) |
| `package.json` `bin` | None |
| Runtime deps | `debug ^4.4.3` |
| Dev deps (current) | `@types/debug ^4.1.12`, `@types/jest ^29.0.0`, `jest ^29.0.0`, `ts-jest ^29.0.0` |
| Dev deps (post-adoption) | `@types/debug` only. `jest`/`ts-jest`/`@types/jest` are unused (see Jest→Vitest section). `vitest`/`typescript`/`tsdown` come from the workspace root. |
| Cross-package deps | None (it's the root of the dep graph) |
| tsconfig (current) | `extends: ../../tsconfig.json` (the source-repo root tsconfig — must rewrite to `extends: ../../tsconfig.base.json`), `composite: true`, `rootDir: ./src`, `outDir: ./dist` |
| Test imports `from 'vitest'` | YES — confirmed in every test file (no jest API anywhere) |
| Tests use `globals: true` | The source workspace's `vitest.config.mts` had `globals: true`, but tests still explicitly import describe/it/expect/vi from `'vitest'` (good — no global-types lookup needed) |

### `@marcfargas/odoo-testcontainers` → `@godoo/testcontainers`

| Property | Value |
|----------|-------|
| Current name / version | `@marcfargas/odoo-testcontainers@0.1.5` |
| Source location | `C:\dev\odoo-toolbox\packages\odoo-testcontainers\` |
| Source files (`src/`) | 13 `.ts` files: `index.ts`, `odoo-container.ts`, `presets.ts`, `version.ts`, `snapshot-cache.ts`, `provisioners/{harness,modules,partners,projects,properties,users,types,index}.ts` |
| Public API surface | `OdooTestContainer`, `OdooTestContainerOptions`, `StartedOdooContainer`, `AddonsMount` (from `./odoo-container`); `startOdoo`, `OdooPresets` (from `./presets`); `normaliseOdooVersion` (from `./version`); `SnapshotCacheOptions` (from `./snapshot-cache`); `* from './provisioners'` |
| Test files (`tests/`) | 7 `.ts` files: 3 integration (`addons-mounting.integration.test.ts`, `basic.integration.test.ts`, `quick-test.integration.test.ts`), 3 unit (`provisioners/{harness,projects}.test.ts`, `unit/snapshot-cache.test.ts`), 1 shared fixture (`shared-odoo-container.ts`) |
| `package.json` `"type"` | Absent (must add `"type": "module"`) |
| `package.json` scripts | `build: tsc`, `test: vitest run` (already correct!), `test:watch: vitest`, `clean: rimraf dist` |
| `package.json` exports | Absent — old `main`/`types` (must convert to ESM exports map) |
| `package.json` `bin` | None |
| Runtime deps | `debug ^4.3.4`, `dockerode ^4.0.0`, `testcontainers ^10.13.2`, `@testcontainers/postgresql ^10.13.2`, `@marcfargas/odoo-client ^0.5.1 \|\| ^0.6.0` (→ rewrite to `workspace:*` → `@godoo/client`) |
| Dev deps | `@types/debug`, `@types/dockerode`, `@types/node`, `typescript`, `vitest` — `typescript`/`vitest` come from workspace root post-adoption; `@types/dockerode`/`@types/debug` must remain |
| `peerDependencies` | `@marcfargas/odoo-client ^0.5.1 \|\| ^0.6.0` — rewrite. Open question: keep peer or drop? With pnpm `workspace:*` deps, peer is redundant inside the monorepo; keeping peer is the safer choice for downstream npm consumers in Phase 3 — rewrite to `@godoo/client: workspace:*` or `@godoo/client: ^X` (Phase 3 sets the version range). **Recommendation:** keep `peerDependencies` block with `@godoo/client: workspace:*` (changesets resolves at publish). |
| Cross-package deps | `@godoo/client` (1 import: `src/odoo-container.ts:11 import { OdooClient, ModuleManager } from '@marcfargas/odoo-client'`) — plus 2 doc/comment mentions in `provisioners/harness.ts:50` and `provisioners/types.ts:111` |
| tsconfig (current) | Same shape as client; rewrite `extends` target |
| Has own `vitest.config.ts` | YES — sets `testTimeout: 600_000`, `hookTimeout: 600_000` (10 min for container startup). **Must carry this over** — without it container starts will time out. |

### `@marcfargas/odoo-introspection` → `@godoo/introspection`

| Property | Value |
|----------|-------|
| Current name / version | `@marcfargas/odoo-introspection@0.2.1` |
| Source location | `C:\dev\odoo-toolbox\packages\odoo-introspection\` |
| Source files (`src/`) | 11 `.ts` files: `index.ts`, `cli/{cli,index}.ts`, `codegen/{formatter,generator,type-mappers,index}.ts`, `introspection/{cache,introspect,types,index}.ts` |
| Public API surface | `* from './introspection'` (includes `Introspector`, types) + `* from './codegen'` (includes `mapFieldType`, `getFieldTypeExpression`, `isWritableField`, `generateFieldJSDoc`, `modelNameToInterfaceName`, `generateModelInterface`, `generateCompleteFile`, `generateHelperTypes`). CLI not re-exported from main index — it has its own bin entry. |
| Test files (`tests/`) | 3 `.ts` files: 2 unit (`codegen.test.ts`, `introspection.test.ts`), 1 integration (`examples.integration.test.ts`) |
| `package.json` `"type"` | Absent (must add `"type": "module"`) |
| `package.json` scripts | `build: tsc`, `test: jest` (stale lie — tests use vitest), `dev: tsc --watch` |
| `package.json` exports | Absent — old `main`/`types` (must convert to ESM exports map) |
| `package.json` `bin` | `"odoo-introspect": "dist/cli/cli.js"` — **must become `dist/cli/cli.mjs`** under tsdown 0.22.0 ESM output. The `cli.ts` source is a 12-line bootstrap that calls `runCli(process.argv.slice(2))` from `./index`. The tsdown `entry` array must include `'./src/cli/cli.ts'` so it emits `dist/cli/cli.mjs`. The cli.mjs needs a `#!/usr/bin/env node` shebang for the bin to be executable — verify tsdown preserves shebangs (or `tsdown.config.ts` may need `shims: true` / explicit shebang config). |
| Runtime deps | `@marcfargas/odoo-client ^0.6.0` (→ rewrite to `workspace:*` → `@godoo/client`), `debug ^4.4.3` |
| Dev deps (current) | `@types/debug`, `@types/jest`, `@types/node`, `jest`, `ts-jest`, `typescript` |
| Dev deps (post-adoption) | `@types/debug`, `@types/node` (typescript/vitest from workspace root) |
| Cross-package deps | `@godoo/client` — 4 source imports (`src/cli/index.ts:28`, `src/codegen/generator.ts:11`, `src/introspection/introspect.ts:12`, JSDoc in `src/index.ts:13-14`) + 1 test import (`tests/examples.integration.test.ts:6`) |
| tsconfig (current) | Same shape; rewrite `extends` target |

## Jest → Vitest Conversion

**Headline finding:** Despite the per-package `package.json` claiming `"test": "jest"` and listing jest/ts-jest/@types/jest as devDeps, **no test file in any of the three packages uses jest APIs**. Every test file already imports `describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach` from `'vitest'`. Tests are run via the source repo's three workspace-level vitest configs.

**Verification commands run:**
```bash
grep -rEn "jest\." C:/dev/odoo-toolbox/packages/odoo-*/tests/ → zero matches
grep -rEn "@types/jest|jest-globals" C:/dev/odoo-toolbox/packages/odoo-*/{src,tests}/ → zero matches
grep -rEn "from 'vitest'" C:/dev/odoo-toolbox/packages/odoo-*/tests/ → matches in every test file
```

**Per-package conversion delta:**

| Package | Test files | jest API rewrites | Devdep removals | jest config to delete |
|---------|------------|--------------------|-----------------|----------------------|
| `@godoo/client` | 22 (12 unit + 10 integration) | 0 | `jest`, `ts-jest`, `@types/jest` | None present in package dir (workspace-level only) |
| `@godoo/testcontainers` | 7 | 0 | None — already vitest-only | None |
| `@godoo/introspection` | 3 | 0 | `jest`, `ts-jest`, `@types/jest` | None present in package dir |

**What still must happen in the rename commit (per D-02):**
1. Delete `jest`, `ts-jest`, `@types/jest` from `devDependencies` (client + introspection).
2. Rewrite `"test": "jest"` → `"test": "vitest run"` (client + introspection). Testcontainers already correct.
3. Verify no `jest.config.*` slipped into the copied directory (none existed at source — confirmed). If one is found in a fresh copy, delete.
4. Verify no `import` from `@jest/globals` or `@types/jest` reference types (none found — confirmed).

**That's it for D-02.** The Phase-2 CONTEXT.md description "rewrites `jest.mock`/`jest.fn`/`jest.spyOn` to the `vi.*` equivalents" was written from the package.json-script reading, not from reading the actual test files. The diff is much smaller. Plans should reflect reality, not the CONTEXT.md wording — D-02's INTENT (no dual-runner state, one-pass conversion) is honored trivially.

## Strict-TS Gap Audit

**Total `any` occurrences in source code (excluding `: unknown`, generic constraints, comments):**

| Package | Source `any` lines | Hotspots | Difficulty |
|---------|--------------------|----------|-----------|
| `@godoo/client` | ~28 source lines (across 14 files) | `src/client/oauth-proxy-client.ts` (4), `src/client/odoo-client.ts` (4), `src/client/types.ts` (4), `src/rpc/bearer-transport.ts` (2), `src/rpc/transport.ts` (1), `src/rpc/types.ts` (1), `src/services/accounting/{accounting-service,functions}.ts` (5), `src/services/{attendance,modules,timesheets}/...` (3), `src/services/cdc/cdc-service.ts` (1 in JSDoc only — not real code) | MEDIUM — most are `domain: any[]` and `args: any[]` for Odoo RPC. Replacement: introduce a `Domain` type (e.g. `type Domain = Array<DomainClause>` where `DomainClause = [string, string, unknown] \| string \| ['&' \| '\|' \| '!']`) and an `RpcArg = unknown` alias, then sweep. Plan must budget for this; not a 5-minute job. |
| `@godoo/testcontainers` | 2 source lines | `src/provisioners/types.ts:119` and `:122` — `domain?: any[]`, `options?: Record<string, any>` in an interface that mirrors the client's loose RPC surface | LOW — borrow the `Domain` type from `@godoo/client` once that's defined (in 02-01); fix in 02-02 by importing the new type. |
| `@godoo/introspection` | 2 real source lines + 1 comment | `src/codegen/formatter.ts:198` (`domain?: any[];` in generated output — the codegen *emits* `any` into user code, separate from internal types), `src/introspection/introspect.ts:121` (`const domain: any[] = []`). `src/codegen/formatter.ts:101` is a string literal of generated code, not actual code. | LOW — same fix as testcontainers; reuse the client's `Domain` type. |

**`@ts-ignore` / `@ts-nocheck` / `biome-ignore` suppressions:** ZERO across all three packages (verified). Nothing to delete.

**Other strict-TS gaps to verify per package during adoption:**
- `isolatedDeclarations: true` requires every public export to have an explicit return type. Source packages were authored without this constraint — a typecheck pass will surface any inferred-return-type exports. Budget time for adding `: ReturnType` annotations.
- `noUncheckedIndexedAccess: true` (set in `tsconfig.base.json`) means `arr[0]` is `T | undefined`. Source code may do unchecked array indexing; expect a handful of "Object is possibly 'undefined'" errors that need narrowing or `// @ts-expect-error` (D-03 forbids the latter — must fix properly).
- `noUnusedVariables: error` (set in `biome.json`) — adopted code that runs clean under ESLint may fail Biome on unused imports/params.

**The strict-clean pass is the largest unknown in the phase.** It's possible the client's 28 `any` lines all collapse to one `Domain` type definition and a series of `any[]` → `Domain` substitutions, in which case the diff is small. It's also possible there's a long tail of inferred-return-type fixes and indexed-access narrowings that surface only when `pnpm tsc --noEmit` runs against the new strict config. Plan 02-01 must include explicit verification steps (`pnpm biome check .` and `pnpm tsc --noEmit` both exit 0 before commit) — those gates catch everything.

## Import-Path Rewrite Scope

Verified by `grep -rEn "@marcfargas/odoo-(client|introspection|testcontainers)" <pkg>/{src,tests}/` excluding generated `dist/`, source maps, and example files. Build artifacts (`dist/`) and `examples/` directories should not be copied into godoo-ts (they'll be regenerated on build).

### `@godoo/client` (CORE-01, plan 02-01)

| File | Reference | Type |
|------|-----------|------|
| `src/client/config.ts:50` | `import { createClient } from '@marcfargas/odoo-client'` | JSDoc `@example` |
| `src/client/oauth-proxy-client.ts:28` | `import { OAuthProxyClient } from '@marcfargas/odoo-client'` | JSDoc `@example` |
| `src/services/index.ts:11` | `import { postInternalNote } from '@marcfargas/odoo-client'` | JSDoc `@example` |
| `README.md` | 5 occurrences (install snippet, code examples, related-packages list) | README — must update |
| `CHANGELOG.md` | 4 occurrences | CHANGELOG — Phase 3 will rebaseline; for Phase 2 leave as-is OR delete the inherited CHANGELOG (recommend delete; Phase 3 generates a fresh one via changesets) |
| `package.json` | `name: @marcfargas/odoo-client` + `repository.url` + `repository.directory` | package.json — rewrite to `@godoo/client`, repo URL `godoo-dev/godoo-ts`, directory `packages/client` |

**Touched files (excluding CHANGELOG): ~5** (3 in src, 1 README, 1 package.json). Plus all the strict-TS edits across the rest of src/.

### `@godoo/testcontainers` (CORE-02, plan 02-02)

| File | Reference | Type |
|------|-----------|------|
| `src/index.ts:2,15` | Doc heading + `@example` block | JSDoc |
| `src/odoo-container.ts:11` | `import { OdooClient, ModuleManager } from '@marcfargas/odoo-client'` | **Real import** — rewrite to `@godoo/client` |
| `src/provisioners/harness.ts:50` | `... of @marcfargas/odoo-client if you need ...` | JSDoc |
| `src/provisioners/types.ts:111` | `The full OdooClient from @marcfargas/odoo-client ...` | JSDoc |
| `README.md` | Multiple occurrences | README — update |
| `package.json` | `name`, `dependencies['@marcfargas/odoo-client']`, `peerDependencies`, `repository.*` | package.json — rewrite |

**Touched files (excluding CHANGELOG): ~5** (4 in src, 1 README, 1 package.json).

### `@godoo/introspection` (CORE-04, plan 02-04)

| File | Reference | Type |
|------|-----------|------|
| `src/index.ts:2,13,14` | Doc heading + `@example` | JSDoc |
| `src/cli/index.ts:28` | `import { OdooClient } from '@marcfargas/odoo-client'` | **Real import** — rewrite to `@godoo/client` |
| `src/codegen/generator.ts:11` | `import { OdooClient } from '@marcfargas/odoo-client'` | **Real import** — rewrite |
| `src/introspection/introspect.ts:12` | `import type { OdooClient } from '@marcfargas/odoo-client'` | **Real import (type-only)** — rewrite |
| `tests/examples.integration.test.ts:6` | `import { OdooClient, ModuleManager } from '@marcfargas/odoo-client'` | **Real test import** — rewrite |
| `README.md` | Multiple occurrences | README — update |
| `package.json` | `name`, `dependencies['@marcfargas/odoo-client']`, `repository.*`, `bin` | package.json — rewrite + `bin` extension swap |

**Touched files (excluding CHANGELOG): ~7** (4 in src, 1 in tests, 1 README, 1 package.json).

### CORE-05 verifier check

After Plan 02-04 lands, run `git grep "@marcfargas/odoo-"` in the godoo-ts repo. The expected output: **only `CHANGELOG.md` files** (if those are preserved). Recommendation: delete inherited CHANGELOG.md from each package in the adoption commit so the grep returns truly zero matches and CORE-05 is verifiable by a single command. Phase 3 will generate fresh CHANGELOGs via changesets.

## Integration-Test Reactivation (CORE-03 mechanics)

This is the most complex plan because the source repo's pattern is **not transplantable** under D-05.

### Current state in `odoo-toolbox`

- Workspace-level `tests/helpers/globalSetup.ts` (~140 lines) uses `testcontainers` + `@testcontainers/postgresql` directly to spin Postgres + Odoo containers, exporting `ODOO_URL`, `ODOO_DB_NAME`, etc. into `process.env`.
- Per-package integration tests read those env vars (e.g. `tests/rpc.integration.test.ts:5`: `const odooUrl = process.env.ODOO_URL || 'http://localhost:8069'`).
- The workspace-level `vitest.integration.config.mts` references `./tests/helpers/globalSetup.ts` as `globalSetup`, includes `packages/*/tests/**/*.integration.test.ts`, excludes `packages/odoo-testcontainers/**` (testcontainers tests start their own containers).
- One test file uses `describe.skipIf(!hasOdoo)(...)` (cdc.integration.test.ts:30) — the rest run unconditionally and fail if `ODOO_URL` is unreachable.

### What CORE-03 must produce in godoo-ts

D-05 mandates **`@godoo/testcontainers` is the single source of truth for container startup**. There's no `docker-compose.test.yml`; there's no `services:` block. Two viable shapes:

**Option A (recommended): per-package globalSetup using `@godoo/testcontainers`.**

Create `packages/client/tests/integration-setup.ts` (or `packages/client/vitest.integration.config.ts` with its own `globalSetup`) that:

```ts
// packages/client/tests/integration-setup.ts
import { startOdoo, type StartedOdooContainer } from '@godoo/testcontainers';

let odoo: StartedOdooContainer | undefined;

export async function setup(): Promise<void> {
  odoo = await startOdoo({ modules: ['base', 'mail', 'crm'] });
  process.env.ODOO_URL = odoo.url;
  process.env.ODOO_DB_NAME = odoo.database;
  process.env.ODOO_DB_USER = 'admin';
  process.env.ODOO_DB_PASSWORD = 'admin';
}

export async function teardown(): Promise<void> {
  await odoo?.cleanup();
}
```

Then `packages/client/vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

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
```

This preserves the existing `process.env.ODOO_URL` contract in the integration test files — **no edits to the 10 `*.integration.test.ts` files needed beyond the rename pass.** That's a huge plan-size saving.

**Option B: rewrite the integration tests to call `startOdoo()` directly in `beforeAll`.**

Higher diff (touches every integration test file), but eliminates the globalSetup indirection. Not recommended — Option A matches the source pattern exactly and lets 02-03 stay scoped.

### Plan 02-01 skip mechanism (what to do in the FIRST adoption commit)

In the same commit that adopts the client, the 10 integration test files must be effectively disabled until 02-03 wires them back up. Three viable approaches:

1. **`describe.skip(...)` wrapping the top-level `describe()` in each file, with inline `// TODO(CORE-03): re-enable after @godoo/testcontainers lands` comment.** Most explicit; the integration tests still parse and typecheck. **Recommended.**
2. **Add `if.skip` via `describe.skipIf(true)` at file top** — equally explicit, less invasive change to existing `describe(...)` calls.
3. **Exclude `**/*.integration.test.ts` from the vitest include pattern via per-package `vitest.config.ts`** — keeps the source files untouched but the "skip mechanism" lives in config, which is easier to forget to undo in 02-03.

**Recommendation:** approach 1. Each integration test file gets a one-line `describe.skip(` and a TODO referencing CORE-03 immediately above the top-level describe. Plan 02-03 deletes those skips as part of its scope.

### Container caching / startup time

The source `OdooTestContainer` supports a `snapshot` option (`SnapshotCacheOptions`) that pg_dumps a baseline DB after first init and restores from snapshot on subsequent starts — a substantial CI-time win since cold Odoo init is ~3 minutes. This is enabled by default per `OdooTestContainerOptions.snapshot`. Plan 02-03 should explicitly verify this works under the godoo-ts harness (or note it as a known-good behavior carried over).

### Integration test count to re-enable

Plan 02-03 will unskip 10 client integration test files containing ~135 `it()`/`test()` calls (sum from the test-count grep). Container startup is shared per file by default; expect total integration suite time ~10-15 min wallclock per Node version.

## Toolchain Conversion Delta (per-package against `_example`)

The `_example` reference is the locked Phase-1 shape; each adopted package mirrors it. Differences each adopted package must overcome:

### Per-package `package.json` rewrites (all three)

| Field | Source value | godoo-ts target value |
|-------|--------------|----------------------|
| `name` | `@marcfargas/odoo-<x>` | `@godoo/<x>` |
| `type` | (absent) | `"module"` |
| `private` | (absent — public) | (absent — these are public packages going to npm in Phase 3) |
| `main` | `dist/index.js` | `./dist/index.mjs` |
| `types` | `dist/index.d.ts` | `./dist/index.d.mts` |
| `exports` | (absent) | `{ ".": { "import": "./dist/index.mjs", "types": "./dist/index.d.mts" } }` (mirror `_example`) |
| `files` | `["dist", "LICENSE", "README.md"]` | (keep as-is; LICENSE may be one level up — verify) |
| `scripts.build` | `tsc` | `tsdown` |
| `scripts.test` | `jest` (client, introspection) or `vitest run` (testcontainers) | `vitest run` |
| `scripts.dev` | `tsc --watch` | `tsdown --watch` (or remove if unused) |
| `scripts.clean` (testcontainers only) | `rimraf dist` | Keep, or rely on `tsdown`'s `clean: true` — recommendation: remove the script and the rimraf devDep |
| `repository.url` | `https://github.com/marcfargas/odoo-toolbox.git` | `https://github.com/godoo-dev/godoo-ts.git` |
| `repository.directory` | `packages/odoo-<x>` | `packages/<x>` |
| `homepage` | (absent) | (optional — `https://github.com/godoo-dev/godoo-ts/tree/main/packages/<x>`) |
| `author` | `Marc Fargas <marc@marcfargas.com>` | Keep (Phase 3 may rebaseline) |
| `bin` (introspection only) | `{ "odoo-introspect": "dist/cli/cli.js" }` | `{ "odoo-introspect": "dist/cli/cli.mjs" }` |
| `dependencies` (cross-package) | `@marcfargas/odoo-client ^X.Y.Z` | `@godoo/client: workspace:*` |
| `peerDependencies` (testcontainers only) | `@marcfargas/odoo-client ^0.5.1 \|\| ^0.6.0` | `@godoo/client: workspace:*` |
| `devDependencies` | jest, ts-jest, @types/jest, typescript, vitest, rimraf as applicable | Remove jest/ts-jest/@types/jest/typescript/vitest/rimraf — all come from workspace root. Keep `@types/debug`, `@types/dockerode` (testcontainers), `@types/node` (introspection) |

### Per-package `tsconfig.json` (all three)

Mirror `_example/tsconfig.json` exactly:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src", "tests"]
}
```

Source repo's tsconfigs extend `../../tsconfig.json` (the source repo's root config) — must be rewritten to `../../tsconfig.base.json`. Source repo also has `exclude: ["dist", "tests", "**/*.test.ts"]` on testcontainers, and `exclude: ["node_modules", "dist", "tests"]` on introspection — drop these; the `_example` pattern is `"include": ["src", "tests"]` (no exclude) so tests get typechecked.

### Per-package `tsdown.config.ts` (all three)

For client and testcontainers: mirror `_example/tsdown.config.ts` verbatim (`entry: ['./src/index.ts']`, `format: 'esm'`, `dts: true`, `clean: true`, `platform: 'node'`).

For introspection: additional CLI entry:

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts', './src/cli/cli.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
});
```

This emits `dist/index.mjs`, `dist/index.d.mts`, `dist/cli/cli.mjs`, `dist/cli/cli.d.mts`. The `bin: { "odoo-introspect": "dist/cli/cli.mjs" }` then resolves. **Verify the emitted `cli.mjs` has a `#!/usr/bin/env node` shebang** — if tsdown 0.22.0 doesn't preserve the absent shebang (source `cli.ts` has none), add one to the source file before adoption (`#!/usr/bin/env node` as the very first line of `src/cli/cli.ts`). The `bin` entry won't be executable on POSIX without it.

### Per-package `vitest.config.ts`

| Package | Need own config? | Why |
|---------|------------------|-----|
| `@godoo/client` (unit only, 02-01) | No — root `vitest.config.ts` with `projects: ['packages/*']` is sufficient | Unit tests are fast, no special timeouts |
| `@godoo/client` (integration, 02-03) | **Yes** — `packages/client/vitest.integration.config.ts` with `globalSetup`, `testTimeout: 600_000`, `hookTimeout: 600_000`, integration include pattern | Container startup demands long timeouts; globalSetup wires testcontainers |
| `@godoo/testcontainers` (02-02) | **Yes** — carry over the source's `vitest.config.ts` (`testTimeout: 600_000`, `hookTimeout: 600_000`) | Container-startup tests need long timeouts |
| `@godoo/introspection` (02-04) | No — root config is sufficient for the 2 unit test files. Integration test (`examples.integration.test.ts`) is out of scope for Phase 2 verification (no requirement covers it) — skip via `describe.skip` with inline TODO or exclude pattern. | |

### Root `tsconfig.json` references

Each adoption commit appends to the root `tsconfig.json` `references[]` array. End state after Phase 2:

```json
{
  "files": [],
  "references": [
    { "path": "packages/client" },
    { "path": "packages/testcontainers" },
    { "path": "packages/introspection" }
  ]
}
```

The first adoption commit (02-01) replaces the lone `{ "path": "packages/_example" }` entry with `{ "path": "packages/client" }`. Subsequent commits append.

## Integration CI Workflow Design

Per D-04: separate `integration` job alongside existing `ci` job, same trigger surface (push to develop/main + PRs to either), same Node 22+24 matrix, runs on `ubuntu-latest`.

### Recommended `.github/workflows/ci.yml` shape after Plan 02-03

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]   # NOTE: existing config only triggers on PRs to main —
                                # 02-03 must widen this to include develop per D-04

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome check .
      - run: pnpm tsc --noEmit
      - run: pnpm build
      - run: pnpm test           # unit only — excludes *.integration.test.ts

  integration:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build         # @godoo/testcontainers must be built before tests can import it
      - run: pnpm test:integration
        env:
          TESTCONTAINERS_RYUK_DISABLED: 'false'
```

### Workspace `test:integration` script

Add to root `package.json`:

```json
"test:integration": "pnpm --filter @godoo/client --filter @godoo/testcontainers run test:integration"
```

And add per-package `test:integration` scripts:
- `packages/client/package.json`: `"test:integration": "vitest run --config vitest.integration.config.ts"`
- `packages/testcontainers/package.json`: `"test:integration": "vitest run"` (its only tests ARE integration tests; the existing `test` script suffices, but a script alias keeps the root command uniform — alternative: include testcontainers' default `test` in `test:integration` filter)

**Important nuance:** the root `pnpm test` (used by the unit `ci` job) currently runs `vitest run` from the root config. The root config uses `test.projects: ['packages/*']` which picks up **every** `*.test.ts` in every package — including `*.integration.test.ts`. Plan 02-01 must either:
- (a) **exclude integration tests from the root config:** add `test.exclude: ['**/*.integration.test.ts']` to root `vitest.config.ts`; OR
- (b) **let per-package vitest configs override include patterns** so only unit tests run by default.

Recommendation: option (a) — explicit exclude at root, single line. Plan 02-01 modifies `vitest.config.ts` accordingly.

### Branch protection ruleset update

Phase 1 D-09 set required status checks to `ci (22)` and `ci (24)`. Plan 02-03 must add `integration (22)` and `integration (24)` to the ruleset. This requires `gh` CLI access; from `01-VERIFICATION.md` deviation #6, complex JSON payloads should use `gh api ... --input -` not `--field`. Concretely:

```bash
gh api repos/godoo-dev/godoo-ts/rulesets/$(gh api repos/godoo-dev/godoo-ts/rulesets --jq '.[]|select(.name=="require-ci-on-main")|.id') \
  -X PUT --input update-ruleset.json
```

Where `update-ruleset.json` includes the existing rules plus the two new required status checks. This is a `checkpoint:human-verify` candidate — branch protection mistakes can lock the maintainer out of merging.

### Docker availability

`ubuntu-latest` runners include Docker pre-installed. No `services:` block needed — `@godoo/testcontainers` drives Docker via the host's daemon. `TESTCONTAINERS_RYUK_DISABLED: 'false'` (the default explicit) ensures Ryuk cleans up orphans; the source repo's CI used this exact env var.

## Plan Slicing Recommendation

Confirming and refining the strawman from focus area #8.

### Wave structure (strict-sequential per D-06)

```
Wave 1 → Wave 2 → Wave 3 → Wave 4
  ↓        ↓        ↓        ↓
02-01    02-02    02-03    02-04
```

Each wave has exactly one plan. Cannot parallelize because each subsequent plan needs the previous plan's workspace state green:
- 02-02 needs `@godoo/client` published as a workspace package before its `workspace:*` import resolves.
- 02-03 needs `@godoo/testcontainers` published before integration tests can import `startOdoo`.
- 02-04 needs `@godoo/client` (for `workspace:*`) — could technically run in parallel with 02-02 or 02-03 since introspection doesn't depend on testcontainers. BUT D-06 locks the sequential order, and parallel runs risk lockfile conflicts. Honor D-06.

### Plan 02-01: Adopt `@godoo/client` (CORE-01)

**Scope:**
1. **Source-side (read-only):** Tag `odoo-toolbox` at `C:\dev\odoo-toolbox` HEAD as `pre-adoption-baseline` (`git -C C:\dev\odoo-toolbox tag pre-adoption-baseline`).
2. Record source SHA: `git -C C:\dev\odoo-toolbox rev-parse HEAD` → use in commit message.
3. **Plain-copy** `C:\dev\odoo-toolbox\packages\odoo-client\{src,tests,README.md,LICENSE}` → `C:\dev\godoo-dev\godoo-ts\packages\client\{src,tests,README.md,LICENSE}`. Do NOT copy `dist/`, `tsconfig.tsbuildinfo`, `*.tgz`, `examples/`, `CHANGELOG.md`, `node_modules/`.
4. Write new `packages/client/package.json` (see Toolchain Conversion table).
5. Write new `packages/client/tsconfig.json` (mirror `_example`).
6. Write new `packages/client/tsdown.config.ts` (mirror `_example`).
7. Rewrite the 3 JSDoc `@example` blocks in `src/{client/config.ts, client/oauth-proxy-client.ts, services/index.ts}` to reference `@godoo/client`.
8. Update README.md (5 occurrences) to use `@godoo/client` + new install snippets.
9. **Skip integration tests:** Wrap each of the 10 `*.integration.test.ts` files' top-level `describe(...)` in `describe.skip(...)`, with TODO comment referencing CORE-03.
10. **Add `vitest.config.ts` root exclude** for `*.integration.test.ts` (so `pnpm test` from root only runs unit tests).
11. **Strict-TS pass:** Replace the ~28 `any` lines with a typed `Domain` / `RpcArg` shape (or `unknown` + narrowing). Run `pnpm tsc --noEmit` and `pnpm biome check .` until both exit 0.
12. **Update root `tsconfig.json`:** swap `{ "path": "packages/_example" }` for `{ "path": "packages/client" }`.
13. **Delete `packages/_example/`** entirely (D-07).
14. Run `pnpm install` to update lockfile; commit lockfile alongside package.json (lockfile-discipline rule).
15. Verification gates (see Workspace Verification Gates section below).
16. Single commit: `feat(client): adopt @marcfargas/odoo-client as @godoo/client (from odoo-toolbox@<sha>)`.

**Estimated diff size:** LARGE — copying 47 source files + 22 test files, deleting _example (4 files), rewriting all package.json/tsconfig/tsdown, 28 strict-TS edits, 10 describe.skip rewrites. Single commit per protocol but it's substantial.

### Plan 02-02: Adopt `@godoo/testcontainers` (CORE-02)

**Scope:**
1. Record source SHA.
2. Plain-copy `odoo-toolbox/packages/odoo-testcontainers/{src,tests,README.md,vitest.config.ts}` → `godoo-ts/packages/testcontainers/`. Skip dist/, node_modules/, *.log files, `tsconfig.tsbuildinfo`, `custom-addons/`, `oca-addons/`, `oca-server-tools/`, `test-addons/` (verify these are tests fixtures — recommendation: copy `test-addons/` if referenced by tests; verify in plan).
3. Write new `package.json` with `workspace:*` cross-dep to `@godoo/client`, `peerDependencies` rewrite, scripts cleanup (drop `rimraf`-dependent `clean` script).
4. Write new `tsconfig.json` (mirror `_example`; drop the source's `exclude: ["dist","tests","**/*.test.ts"]`).
5. Write new `tsdown.config.ts` (mirror `_example`).
6. Keep the per-package `vitest.config.ts` for the 600s timeouts.
7. Rewrite the 1 real import + 3 JSDoc references to `@godoo/client`.
8. Update README.md.
9. **Strict-TS pass:** 2 `any` lines in `provisioners/types.ts` — fix using the `Domain` type defined in 02-01 (imported from `@godoo/client`).
10. Update root `tsconfig.json` references: append `{ "path": "packages/testcontainers" }`.
11. `pnpm install` (lockfile update).
12. Verification gates.
13. Commit: `feat(testcontainers): adopt @marcfargas/odoo-testcontainers as @godoo/testcontainers (from odoo-toolbox@<sha>)`.

**Note:** Per D-04 the integration CI job is added in 02-03, NOT here — so 02-02's verification runs **only** the unit tests (`packages/testcontainers/tests/provisioners/{harness,projects}.test.ts` + `tests/unit/snapshot-cache.test.ts`). The 3 integration tests should be excluded from the workspace `pnpm test` run (already handled by the root vitest exclude pattern added in 02-01). They'll execute under `pnpm test:integration` once 02-03 wires that up.

### Plan 02-03: Re-enable client integration tests + integration CI job (CORE-03)

**Scope:**
1. Create `packages/client/tests/integration-setup.ts` (calls `startOdoo()` from `@godoo/testcontainers`, exports `setup`/`teardown`).
2. Create `packages/client/vitest.integration.config.ts` (globalSetup, timeouts, integration include pattern).
3. Add `test:integration` scripts at root + per-package.
4. **Delete the `describe.skip(...)` wrappers + TODOs** in all 10 client `*.integration.test.ts` files (from Plan 02-01).
5. Add `integration` job to `.github/workflows/ci.yml` (per Integration CI Workflow Design section).
6. Update `pull_request.branches` trigger surface to include `develop` (D-04 mandate; currently only `main`).
7. Verify Docker available locally (`docker info` exits 0).
8. Run `pnpm test:integration` locally — must pass.
9. Update branch protection ruleset to add `integration (22)` and `integration (24)` to required status checks. This is a `checkpoint:human-verify` task (use `gh api ... --input -`).
10. Push to a PR branch, verify CI workflow `integration` job appears and passes.
11. Verification gates.
12. Commit: `feat(client): re-enable integration tests against @godoo/testcontainers (CORE-03)`.

**Note:** this plan does NOT adopt any new package — it wires the existing two. It's the smallest plan in terms of file count but introduces the integration CI infrastructure (highest CI complexity).

### Plan 02-04: Adopt `@godoo/introspection` (CORE-04)

**Scope:**
1. Record source SHA.
2. Plain-copy `odoo-toolbox/packages/odoo-introspection/{src,tests,README.md,LICENSE}` → `godoo-ts/packages/introspection/`.
3. **Add `#!/usr/bin/env node` shebang** as the first line of `packages/introspection/src/cli/cli.ts` (verify tsdown emits it to `dist/cli/cli.mjs`).
4. Write new `package.json`: `workspace:*` dep on `@godoo/client`, `bin: { "odoo-introspect": "dist/cli/cli.mjs" }`, scripts cleanup.
5. Write new `tsconfig.json` (mirror `_example`; drop the `exclude` override).
6. Write new `tsdown.config.ts` with TWO entries: `./src/index.ts` AND `./src/cli/cli.ts`.
7. Rewrite the 3 source imports + 1 test import + JSDoc references to `@godoo/client`.
8. Update README.md.
9. **Skip the integration test** (`tests/examples.integration.test.ts`) — no requirement covers it; mark `describe.skip` with TODO referencing a future phase. Alternative: include it in the integration CI matrix; recommendation is to skip because no Phase-2 requirement covers introspection integration testing.
10. **Strict-TS pass:** 2 `any` lines (`introspection/introspect.ts:121`, `codegen/formatter.ts:198`). Fix with the same `Domain` type pattern. Also verify the `formatter.ts:101` string-literal `any[]` is just a generated-code template (not actual code).
11. Update root `tsconfig.json` references: append `{ "path": "packages/introspection" }`.
12. `pnpm install` (lockfile update).
13. **Verify `bin` works:** `pnpm --filter @godoo/introspection exec odoo-introspect --help` should succeed.
14. Verification gates (now include `pnpm test:integration` from 02-03's infrastructure).
15. Commit: `feat(introspection): adopt @marcfargas/odoo-introspection as @godoo/introspection (from odoo-toolbox@<sha>)`.

### Dependencies summary

```
Wave 1: 02-01 (delete _example, adopt client, skip integration tests)
        ↓
Wave 2: 02-02 (adopt testcontainers, workspace:* → @godoo/client)
        ↓
Wave 3: 02-03 (wire @godoo/testcontainers as client's globalSetup; add integration CI job; unskip 10 files; update branch protection)
        ↓
Wave 4: 02-04 (adopt introspection, workspace:* → @godoo/client; fix bin .mjs)
```

No missing dependencies. The strict-TS `Domain` type defined in 02-01 is reused in 02-02 and 02-04 (small reuse — defining it once in client and re-exporting is the clean play).

## Workspace Verification Gates

Each plan's commit must not land until these all pass green:

### After 02-01

| Gate | Command | Expected |
|------|---------|----------|
| Workspace install | `pnpm install --frozen-lockfile` | Exit 0 |
| Lint/format | `pnpm biome check .` | Exit 0 (no `noExplicitAny`, no `noUnusedVariables`, no format diffs) |
| Typecheck (full workspace) | `pnpm tsc --noEmit` | Exit 0 (strict, isolatedDeclarations, noUncheckedIndexedAccess all satisfied) |
| Build | `pnpm build` | Exit 0; produces `packages/client/dist/index.mjs` + `dist/index.d.mts` |
| Unit tests | `pnpm test` | All client unit tests pass; integration tests SKIPPED (describe.skip); zero failures |
| `_example` is gone | `test ! -d packages/_example` | Pass |
| No `@marcfargas/odoo-client` references | `git grep "@marcfargas/odoo-client" packages/client/` | Returns only CHANGELOG.md (if preserved) — recommend zero matches |
| Lockfile committed | `git status pnpm-lock.yaml` | Lockfile present, committed in same commit as package.json |
| CI green | `gh run watch <run-id>` | Both `ci (22)` and `ci (24)` succeed |

### After 02-02

| Gate | Command | Expected |
|------|---------|----------|
| All 02-01 gates | (as above, now also covering testcontainers) | All pass |
| Workspace dep resolves | `pnpm --filter @godoo/testcontainers list @godoo/client` | Shows `link:../client` |
| testcontainers unit tests | `pnpm --filter @godoo/testcontainers run test -- --reporter=verbose 'tests/provisioners' 'tests/unit'` | All pass |
| Integration tests still skipped | grep for `describe.skip` in `packages/client/tests/*.integration.test.ts` | 10 occurrences (unchanged from 02-01) |
| CI green | | `ci (22)` + `ci (24)` succeed |

### After 02-03

| Gate | Command | Expected |
|------|---------|----------|
| All 02-02 gates | | All pass |
| No `describe.skip` in client integration tests | `grep -c "describe.skip" packages/client/tests/*.integration.test.ts` | 0 |
| No CORE-03 TODOs in integration tests | `grep -rn "CORE-03" packages/client/tests/` | 0 |
| Local integration run | `pnpm test:integration` | All 10 client integration test files pass + 3 testcontainers integration tests pass |
| Docker artifacts cleaned | `docker ps -a` | No leftover odoo/postgres containers |
| Integration CI job exists | `gh workflow view CI --yaml \| grep -c "^  integration:"` | 1 |
| Branch protection updated | `gh api repos/godoo-dev/godoo-ts/rulesets/<id> --jq '.rules[].parameters.required_status_checks'` | Contains `ci (22)`, `ci (24)`, `integration (22)`, `integration (24)` |
| CI green (both jobs) | | All four checks succeed |

### After 02-04

| Gate | Command | Expected |
|------|---------|----------|
| All 02-03 gates | | All pass |
| Workspace dep resolves | `pnpm --filter @godoo/introspection list @godoo/client` | Shows `link:../client` |
| introspection unit tests | `pnpm --filter @godoo/introspection run test` | All pass |
| Bin works | `pnpm --filter @godoo/introspection exec odoo-introspect --help` | Exit 0, prints help |
| Bin output is .mjs | `cat packages/introspection/package.json \| jq -r '.bin["odoo-introspect"]'` | `dist/cli/cli.mjs` |
| dist/cli/cli.mjs has shebang | `head -1 packages/introspection/dist/cli/cli.mjs` | `#!/usr/bin/env node` |
| CORE-05 verifier | `git grep "@marcfargas/odoo-" \-\- packages/` | 0 matches (or only CHANGELOG.md if preserved) |
| CI green | | All four checks succeed |

### Phase-2 final verification (before `/gsd:verify-work`)

- `pnpm install --frozen-lockfile && pnpm biome check . && pnpm tsc --noEmit && pnpm build && pnpm test && pnpm test:integration` all exit 0 on a clean checkout.
- `git grep "@marcfargas/odoo-"` returns zero matches in `packages/`.
- All four CI jobs (`ci (22)`, `ci (24)`, `integration (22)`, `integration (24)`) green on develop.
- `odoo-toolbox` has the `pre-adoption-baseline` tag (verifiable: `git -C C:\dev\odoo-toolbox tag -l pre-adoption-baseline` returns the tag name).

## Phase-1 Landmines to Honor

Re-read of `01-VERIFICATION.md` surfaces these adopted-package conformance traps:

1. **Exports map must use `.mjs`/`.d.mts`, not `.js`/`.d.ts`** (auto-fix #2). tsdown 0.22.0 emits `.mjs`/`.d.mts`; the exports map must match. Source-repo `package.json` files all use `.js`/`.d.ts` — every adopted package.json MUST be rewritten.
2. **Biome 2.4.15 schema:** `organizeImports` lives at `assist.actions.source.organizeImports`, NOT at top-level; `files.includes` (with `!` negation) replaces `files.ignore`. Already correct in `biome.json` — no action needed, but if any adopted package introduces its own biome.json override (don't — one workspace-level config per D-03), use the right schema.
3. **pnpm 11 `allowBuilds` for postinstall scripts:** `pnpm-workspace.yaml` currently allows `lefthook`. If any adopted package's dependency tree introduces a new postinstall (e.g. `testcontainers` could pull in an SDK with one), `pnpm install` may fail with an allowBuilds prompt. Run `pnpm install` early in each plan to surface this; add to `allowBuilds:` if needed.
4. **lefthook is pinned at 2.1.6 because pnpm minimumReleaseAge rejected 2.1.7.** Don't naively bump.
5. **Tests import source via `.js` extension under `nodenext`** — e.g. `from '../src/index.js'` (NOT `'../src/index'` and NOT `'../src/index.ts'`). Source-repo tests import without extensions (e.g. `from '../src/client/odoo-client'`). **Every adopted test file's import path may need a `.js` suffix added.** This is a global edit across all 32 test files (22 client + 7 testcontainers + 3 introspection). Verify by running `pnpm tsc --noEmit` — nodenext will complain loudly if extensions are missing.
6. **`composite: true` per-package + root `references[]`** — required for the `_example` pattern. Every adopted package's tsconfig must have `composite: true`; root `tsconfig.json` must append a `references[]` entry. Tsdown doesn't care, but `pnpm tsc --noEmit` does.
7. **`tests/` directory at package root** (not `__tests__/`, not co-located). Source repo matches this convention; no relocation needed.
8. **Branch protection required-status-check NAMES** must match the GitHub Actions job name + matrix dimension exactly: `ci (22)`, `ci (24)`, and (Plan 02-03 onward) `integration (22)`, `integration (24)`. A typo here silently makes the check non-required.
9. **`gh api --field` doesn't handle complex JSON** (deviation #6 from Phase 1). Branch protection edits in Plan 02-03 must use `gh api ... --input -` (stdin) or `--input update.json`.
10. **Plan 01-01 made Plan 01-02 verification-only** because executors front-load work. Plan 02-01 is similarly large and risks absorbing 02-02/02-03 scope — the planner must be strict about scope boundaries (D-07 says _example is deleted in commit 1, NOT before).

## Common Pitfalls (Phase-2-specific)

### Pitfall 1: Copying `dist/` or `tsconfig.tsbuildinfo` from source
**What goes wrong:** Stale build artifacts confuse tsdown/tsc; the source `.js`/`.d.ts` files clash with the new `.mjs`/`.d.mts` outputs.
**How to avoid:** Explicit copy whitelist: `src/`, `tests/`, `README.md`, `LICENSE`. NEVER copy `dist/`, `node_modules/`, `tsconfig.tsbuildinfo`, `*.tgz`, `*.log`, `examples/`, `CHANGELOG.md`.
**Warning sign:** First `pnpm build` produces both `.js` AND `.mjs` outputs.

### Pitfall 2: Forgetting `.js` extension on test imports under nodenext
**What goes wrong:** `pnpm tsc --noEmit` fails with `Relative import paths need explicit file extensions in EcmaScript imports when '--moduleResolution' is 'node16' or 'nodenext'`.
**How to avoid:** Bulk-rewrite every test file's source-import path during adoption: `from '../src/foo/bar'` → `from '../src/foo/bar.js'`. Add a verification step.
**Warning sign:** Source repo tests work, godoo-ts adopted tests fail at typecheck even though source files exist.

### Pitfall 3: Missing shebang on `dist/cli/cli.mjs`
**What goes wrong:** `odoo-introspect` bin entry points at a `.mjs` file with no `#!/usr/bin/env node` — fails to execute on POSIX with `cannot execute binary file: Exec format error`.
**How to avoid:** Add shebang as line 1 of `src/cli/cli.ts` before adoption; verify tsdown preserves it (`head -1 dist/cli/cli.mjs`).
**Warning sign:** `pnpm --filter @godoo/introspection exec odoo-introspect --help` fails with exec error.

### Pitfall 4: Root vitest config picks up integration tests in `pnpm test`
**What goes wrong:** Plan 02-01 lands; `pnpm test` from the workspace root runs the client's `*.integration.test.ts` files (because root's `test.projects: ['packages/*']` does no filtering); they fail because there's no Odoo container.
**How to avoid:** In Plan 02-01, add `test.exclude: ['**/*.integration.test.ts']` to root `vitest.config.ts`. Alternative: rely on `describe.skip` (but skipped tests still show in output as skipped, which is noisier than excluded).
**Warning sign:** CI `ci (22)` fails on the first push after 02-01.

### Pitfall 5: `peerDependencies` becomes stale `*` after workspace rewrite
**What goes wrong:** testcontainers' `peerDependencies['@marcfargas/odoo-client']` becomes `peerDependencies['@godoo/client']: workspace:*`. At publish time (Phase 3), `workspace:*` resolves to an exact version — but if a consumer installs an older `@godoo/client` than the testcontainers build was compiled against, peer check passes but ABI may break.
**How to avoid:** Note as a Phase-3 publish concern, not a Phase-2 concern. Document in 02-02's plan as a deferred consideration.
**Warning sign:** Not visible until Phase 3 publish.

### Pitfall 6: Phase-2 lands but `git -C odoo-toolbox tag pre-adoption-baseline` was never run
**What goes wrong:** The godoo-adoption-protocol step 1 (source-side) is unsatisfied; Phase 3 has no reference baseline to remove packages from.
**How to avoid:** Plan 02-01's FIRST step is the source tag. Make it a verification gate (the tag exists in `C:\dev\odoo-toolbox`).
**Warning sign:** Phase-2 verification finds the tag missing.

### Pitfall 7: Integration tests time out at vitest's default 5s
**What goes wrong:** `startOdoo()` takes 30-180 seconds; vitest default `testTimeout: 5000ms` aborts before the container is ready. Phase-1 vitest didn't have container tests so the default was fine.
**How to avoid:** Per-package `vitest.config.ts` (testcontainers, client integration) MUST set `testTimeout: 600_000` and `hookTimeout: 600_000`. Copied directly from source-repo's `packages/odoo-testcontainers/vitest.config.ts`.
**Warning sign:** Integration test reports "Test timed out in 5000ms" in `beforeAll`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Odoo container lifecycle for tests | A custom Dockerfile + docker-compose orchestration script | `@godoo/testcontainers` (`startOdoo()` / `OdooTestContainer`) | D-05 explicitly forbids; the package exists for this |
| Postgres container for Odoo | Manual `docker run postgres ...` | `PostgreSqlContainer` from `@testcontainers/postgresql` (already used inside `@godoo/testcontainers`) | Handles random ports, ryuk cleanup |
| Container-snapshot caching for fast restarts | Custom pg_dump scripts | `OdooTestContainerOptions.snapshot` (already implemented in source `snapshot-cache.ts`) | Already battle-tested in source |
| Globbing test files | Custom finder | vitest's `test.include` + `test.exclude` patterns | Standard vitest API |
| Odoo RPC client | Custom fetch wrapper | `@godoo/client` (`OdooClient`) | The whole point of CORE-01 |
| TypeScript-from-Odoo-schema generation | Manual codegen | `@godoo/introspection` (`Introspector` + `generateCompleteFile`) | The whole point of CORE-04 |
| ESM `.mjs` + `.d.mts` build output | Custom esbuild config | `tsdown 0.22.0` (already wired in Phase 1) | Phase-1 D-02 locked this |
| Workspace-internal dep resolution | manual symlinks | pnpm `workspace:*` | Phase-1 locked this; idiomatic |
| Pre-commit lint | husky + lint-staged | lefthook (already wired) | Phase-1 D-04 locked this |

**Key insight:** Phase 2 is a code-transfer, not a greenfield build. The hand-roll temptation is zero — every primitive already exists either in the Phase-1 toolchain or in the source packages being adopted. The only NEW code in this phase is `packages/client/tests/integration-setup.ts` (~20 lines wiring `startOdoo()` into globalSetup), and even that mirrors the source repo's `tests/helpers/globalSetup.ts` pattern with one substitution.

## Runtime State Inventory

This is a code-transfer + rename phase, so the runtime-state checklist applies. Audit:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — godoo-ts has no databases, no key-value stores, no persistent state beyond git itself. Per `STATE.md` and `PROJECT.md` re-read: project state is purely git-tracked source. | None |
| **Live service config** | None — no n8n, Datadog, Tailscale, Cloudflare Tunnel, or similar referenced anywhere in `.planning/` or `CLAUDE.md`. The GitHub repo has a branch ruleset (`require-ci-on-main`, verified in Phase-1) — this references `ci (22)` / `ci (24)` job names by string, so Plan 02-03 must update the ruleset to add `integration (22)` / `integration (24)`. | Plan 02-03: `gh api ... --input -` to PATCH the ruleset |
| **OS-registered state** | None — no Windows Task Scheduler, pm2, launchd, or systemd entries reference `@marcfargas/*` or `odoo-toolbox`. Verified by absence of such references in `STATE.md` / `PROJECT.md` / `CLAUDE.md`. | None |
| **Secrets and env vars** | Integration tests read `ODOO_URL`, `ODOO_DB_NAME`, `ODOO_DB_USER`, `ODOO_DB_PASSWORD`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`, `ODOO_VERSION` from `process.env`. These are NOT secrets (they're test-container creds, default `admin`/`admin`). They are injected by the new globalSetup in Plan 02-03 from the running container — no `.env` file or GitHub secret needed. No real secrets handled in Phase 2. | Plan 02-03 globalSetup sets these from `startOdoo()` return value |
| **Build artifacts / installed packages** | `odoo-toolbox` has `dist/`, `node_modules/`, `tsconfig.tsbuildinfo`, `*.tgz` artifacts under each package — these are NEVER copied into godoo-ts (whitelist-only copy). In godoo-ts itself, deleting `packages/_example/` (Plan 02-01) leaves no stale artifacts because Phase 1 only built it locally and `pnpm install` reconciles. After 02-04, `pnpm install --frozen-lockfile && pnpm build` should produce a clean `packages/{client,testcontainers,introspection}/dist/` tree. The npm package `@marcfargas/odoo-introspection` had a `bin` registered globally if anyone ever ran `npm install -g` — but the planner can ignore this; nothing in godoo-ts touches that. | None — the whitelist copy strategy prevents stale-artifact carryover |

**The canonical question — "After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?":** The GitHub branch ruleset's `required_status_checks` list. Plan 02-03 must update it. That's the only runtime-state item. Everything else is purely code-edit.

## Environment Availability

Required tools/dependencies for Phase 2 execution and CI:

| Dependency | Required By | Available locally (marcwin) | Available in CI (`ubuntu-latest`) | Fallback |
|------------|-------------|----------------------------|----------------------------------|----------|
| Node.js ≥22.18.0 | Build, test, runtime | Verified by `engines.node` in Phase-1 — assume yes (pnpm-managed) | Yes, via `actions/setup-node@v4` (already wired) | — |
| pnpm 11.1.3 | Workspace install | `packageManager` field locks it; Corepack handles | Yes, via `pnpm/action-setup@v6` | — |
| git | Source-side tag, blame, commits | Yes (Phase-1 used it) | Yes, via `actions/checkout@v4` | — |
| `gh` CLI | Branch protection ruleset update (Plan 02-03) | Authenticated per Phase-1 D-08 | Not required in CI (admin task only) | — |
| Docker | `@godoo/testcontainers` integration tests | **MUST verify on marcwin** before Plan 02-03 local run. Windows users typically run Docker Desktop; verify `docker info` exits 0. | Yes — `ubuntu-latest` includes Docker | If absent locally: dev can rely on CI for integration verification, but local-iterate loop is slower |
| Odoo Docker images (`odoo:17`, `odoo:18`, `odoo:19`) | testcontainers integration tests | Pulled on first run (~1.5 GB) | Pulled on first run | — |
| Postgres Docker image (`postgres:15-alpine`) | testcontainers | Pulled on first run | Pulled on first run | — |
| Local source repo at `C:\dev\odoo-toolbox` | Tag baseline + copy source files | Required — Phase 2 cannot proceed without it | N/A | — |
| Sibling `godoo-hq` repo at `../godoo-hq/` | UMBRELLA_CLAUDE.md `@`-import | Verified in Phase-1 (file resolves) | N/A | — |

**Missing dependencies with no fallback:** None blocking. Docker availability locally is a should-verify, not a blocker (CI covers it).

**Missing dependencies with fallback:** Docker locally — fallback is iterating via CI for integration tests.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | tsdown 0.22.0 preserves source-file shebangs in emitted `.mjs` output | Toolchain Conversion Delta — introspection bin | If wrong: `dist/cli/cli.mjs` lacks `#!/usr/bin/env node`, the bin isn't executable on POSIX. Mitigation: Plan 02-04 explicitly verifies via `head -1 dist/cli/cli.mjs`; if absent, fix `tsdown.config.ts` (e.g. via a banner / shebang plugin) or write the shebang into `cli.ts` source AND verify it survives the build. [ASSUMED] |
| A2 | The `@godoo/client` strict-TS pass is moderate (~28 `any` lines + a `Domain` type definition) and not a long tail of inferred-return-type fixes | Strict-TS Gap Audit | If wrong: Plan 02-01 takes substantially longer than expected; might warrant splitting into 02-01a (adopt + skip integration) and 02-01b (strict-TS pass). Mitigation: Plan 02-01 verification gate `pnpm tsc --noEmit` exits 0 catches all gaps; if the gap count surprises, escalate via plan-check. [ASSUMED — based on grep, not on running tsc] |
| A3 | Container snapshot caching (`OdooTestContainerOptions.snapshot`) works correctly in godoo-ts's CI environment | Integration-Test Reactivation | If wrong: integration tests work but every CI run pays the full 3-min Odoo cold-init cost. Not blocking — just slow. Mitigation: keep `snapshot: true` (default), monitor CI runtime; if cache pollutes, disable. [ASSUMED — feature existed in source, never tested in CI from godoo-ts] |
| A4 | testcontainers package's source `test-addons/`, `oca-addons/`, `custom-addons/` directories are test fixtures referenced by integration tests, not noise from `oca-server-tools` | Source Package Shapes | If wrong: copying them carries spurious mass; not copying them breaks integration tests. Mitigation: Plan 02-02 reads `tests/*.integration.test.ts` for `bindMount` / `addonsPath` references before deciding which to copy. [ASSUMED — file listing only, no read of test contents] |
| A5 | The integration test files' env-var contract (`process.env.ODOO_URL` etc.) is identical across all 10 client integration test files | Integration-Test Reactivation Option A | If wrong: a stray test reads e.g. `ODOO_HOST` and Option A misses it. Mitigation: Plan 02-03 greps `process.env\.` across all integration test files before writing globalSetup; if surprises found, expand the env injection. [VERIFIED via grep — `ODOO_URL`, `ODOO_DB_NAME`, `ODOO_DB_USER`, `ODOO_DB_PASSWORD` cover client; `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD` are alternative names used by examples.integration.test.ts. Both sets need injection.] |
| A6 | `peerDependencies: { "@godoo/client": "workspace:*" }` resolves correctly under pnpm 11 for workspace-internal consumption | Toolchain Conversion Delta — testcontainers | If wrong: pnpm install fails or testcontainers can't find @godoo/client at test time. Mitigation: Plan 02-02 verification gate `pnpm --filter @godoo/testcontainers list @godoo/client` returns `link:../client`. [CITED — standard pnpm pattern, documented at pnpm.io] |

## Open Questions

1. **Should adopted CHANGELOG.md files be preserved or deleted?**
   - What we know: D-02 says "version baseline is Phase 3's call"; CHANGELOG.md contains old `@marcfargas/odoo-*` references that would cause CORE-05 grep to find false-positive matches.
   - What's unclear: whether marc wants the changelog history preserved for archaeology or wiped clean (changesets regenerates from PR commits anyway).
   - Recommendation: **delete inherited CHANGELOG.md in the adoption commit**; the source-side tagged baseline (`pre-adoption-baseline`) and Phase 3's deprecation README cover archaeology. Verify with marc in discuss-phase if uncertain. Filed as Open Question rather than locked because CONTEXT.md doesn't address it.

2. **What does the strict-TS `Domain` type look like, exactly?**
   - What we know: Odoo domains are arrays of `[field, operator, value]` tuples plus `'&'` / `'\|'` / `'!'` logical operators.
   - What's unclear: whether to make this fully type-safe (operator-literal union, etc.) or pragmatically `Array<DomainLeaf \| DomainOperator>` with `DomainLeaf = [string, string, unknown]`.
   - Recommendation: pragmatic shape with `unknown` for the value position; full type-safety can come in a later quality-of-life plan. The phase requirement is "passes strict TS", not "domain values are statically validated".

3. **Should the introspection package's `examples.integration.test.ts` be enabled in Phase 2 or skipped?**
   - What we know: it's the only integration test for introspection; no Phase-2 requirement (CORE-04 says "tests pass" but the integration test was previously skipped at the workspace level).
   - What's unclear: whether marc wants it covered by the new integration CI or deferred.
   - Recommendation: **skip in Plan 02-04 with TODO**; running it requires extending the integration job to also run introspection tests, which slightly broadens 02-04 scope. Defer to a follow-up phase if needed. Confirm in discuss-phase.

## Security Domain

Per `.planning/config.json` `security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (Odoo auth in client) | `OdooClient.authenticate()` uses Odoo's native session handshake — `/web/session/authenticate` with username/password. No custom crypto. |
| V3 Session Management | yes | Session token returned by Odoo, stored in `OdooClient` instance. No client-side session storage. |
| V4 Access Control | no | godoo-ts is a library, not an app — access control is the consumer's responsibility |
| V5 Input Validation | no for Phase 2 | Library passes RPC args through; consumers validate. Phase-2 work is rename/refactor, not new input surfaces. |
| V6 Cryptography | no | No crypto code in adopted packages — uses HTTPS (Node fetch) and Odoo's session cookie |
| V7 Error Handling | yes | `OdooAuthError`, error narrowing in `src/types/errors.ts` — verify error messages don't leak credentials during strict-TS pass |
| V8 Data Protection | yes | Integration tests inject test-only `admin/admin` creds via `process.env` — these are NOT production secrets, but the planner should ensure the globalSetup doesn't accidentally log the password (per `secrets-handling.md`). |
| V14 Configuration | yes | Branch protection ruleset (Plan 02-03) — verify required status checks include the integration job names exactly |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential logging in CI output | Information Disclosure | `globalSetup.ts` writes to `process.env` (not console). Verify `console.log` calls in adopted code don't print passwords. The source `globalSetup.ts` does NOT log credentials — confirmed by read. |
| Cross-package supply-chain via `workspace:*` | Supply Chain | All `workspace:*` deps resolve to in-repo source — no external supply chain inside the workspace. Phase 3 publish will introduce external resolution; out of scope here. |
| ts-jest / jest devDeps left as dead weight | Supply Chain (unused-attack-surface) | D-02 mandates removal. Verifier: `git grep -E '"(ts-jest\|jest\|@types/jest)"' packages/` → 0 matches. |
| `eval`-like dynamic code in codegen | Injection | `@godoo/introspection` generates TypeScript source as strings (`generateCompleteFile`). The strings are written to files, not eval'd. Verified — no `eval()` or `Function()` calls in source. |
| GitHub branch protection bypass | Tampering | Solo maintainer with admin can force-push; D-09 sets non_fast_forward + required checks. Plan 02-03 must NOT loosen non_fast_forward; only adds checks. |
| Test containers leaking past test runs | Resource exhaustion / DoS | `OdooTestContainer.cleanup()` + Ryuk handle this. `TESTCONTAINERS_RYUK_DISABLED: 'false'` (default) in CI. |

**No security blockers identified.** The phase is a rename + refactor of a library; it doesn't introduce new attack surfaces beyond what already exists in the source packages. Phase-3 publishing will need a separate npm-supply-chain review (provenance, 2FA, etc.) — explicitly out of scope here.

## State of the Art

| Old approach (in source repo) | Current approach (godoo-ts target) | When changed | Impact |
|--------------------------------|-----------------------------------|--------------|--------|
| `tsc` per-package builds | `tsdown` ESM-only builds | Phase 1 | Faster builds; `.mjs`/`.d.mts` outputs; exports map must reference them |
| ESLint + Prettier | Biome 2.4.15 | Phase 1 | Single config; faster; `noExplicitAny: error` enforced |
| husky + lint-staged | lefthook 2.1.6 | Phase 1 | One Go binary, no npm tax |
| npm workspaces | pnpm workspaces 11.1.3 | Phase 1 | Faster, hardlinks, `workspace:*` |
| jest + ts-jest | vitest (already used by tests, devDeps just stale) | Phase 1 (godoo-ts choice) | Modern, ESM-native, but tests didn't need rewriting |
| Workspace-level vitest configs (3 files) | Root vitest with `projects: ['packages/*']` + per-package overrides | Phase 1 | Auto-pickup of new packages |
| `docker-compose.test.yml` + `globalSetup.ts` driving raw `testcontainers` | `@godoo/testcontainers.startOdoo()` via globalSetup | Phase 2 (D-05) | Single source of truth for container lifecycle |
| `dist/cli/cli.js` bin entry | `dist/cli/cli.mjs` bin entry (with shebang) | Phase 2 (D-02 + tsdown 0.22.0) | ESM-native bin |

**Deprecated/outdated:**
- The source-repo `packages/*/package.json` `"test": "jest"` script lines — never actually invoked.
- jest, ts-jest, @types/jest devDeps in client + introspection — never actually used.
- Workspace-level `vitest.integration.config.mts` from odoo-toolbox — godoo-ts uses per-package configs instead.
- `docker-compose.test.yml` from odoo-toolbox — godoo-ts uses `@godoo/testcontainers` exclusively per D-05.

## Sources

### Primary (HIGH confidence — direct file reads)

- `C:\dev\godoo-dev\godoo-ts\.planning\phases\02-core-3-adoption-rename\02-CONTEXT.md` — phase locked decisions D-01..D-07, Claude's discretion items, deferred ideas
- `C:\dev\godoo-dev\godoo-ts\.planning\REQUIREMENTS.md` — CORE-01..05 text
- `C:\dev\godoo-dev\godoo-ts\.planning\ROADMAP.md` §"Phase 2" — phase goal and success criteria
- `C:\dev\godoo-dev\godoo-ts\.planning\STATE.md` — current position, blockers
- `C:\dev\godoo-dev\godoo-ts\.planning\PROJECT.md` — constraints, key decisions
- `C:\dev\godoo-dev\godoo-ts\.planning\phases\01-repo-toolchain-bootstrap\{01-CONTEXT,01-VERIFICATION}.md` — Phase-1 substrate
- `C:\dev\godoo-dev\godoo-hq\.planning\notes\godoo-adoption-protocol.md` — protocol authoritative definition
- `C:\dev\godoo-dev\godoo-ts\CLAUDE.md` — umbrella import + project constraints
- `C:\dev\godoo-dev\godoo-ts\packages\_example\{package.json,tsconfig.json,tsdown.config.ts,src/index.ts,tests/index.test.ts}` — template
- `C:\dev\godoo-dev\godoo-ts\{tsconfig.base.json,tsconfig.json,biome.json,vitest.config.ts,pnpm-workspace.yaml,lefthook.yml,package.json,.github/workflows/ci.yml,.planning/config.json}`
- `C:\dev\odoo-toolbox\packages\odoo-client\{package.json,tsconfig.json,src/index.ts,src/...,tests/...}` (47 src + 22 test files; full structure listed via Glob/find)
- `C:\dev\odoo-toolbox\packages\odoo-testcontainers\{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/odoo-container.ts,src/presets.ts,tests/basic.integration.test.ts}` + structure
- `C:\dev\odoo-toolbox\packages\odoo-introspection\{package.json,tsconfig.json,src/index.ts,src/cli/cli.ts,tests/introspection.test.ts,tests/codegen.test.ts,tests/examples.integration.test.ts}` + structure
- `C:\dev\odoo-toolbox\{package.json,vitest.config.mts,vitest.integration.config.mts,vitest.packaging.config.mts,tests/helpers/globalSetup.ts,.github/workflows/test.yml}` — source workspace toolchain context

### Secondary (MEDIUM confidence)

- pnpm `workspace:*` semantics — documented at pnpm.io, well-known idiom
- tsdown 0.22.0 ESM output behavior — verified empirically in Phase-1 `_example` build (produces `.mjs`/`.d.mts`)

### Tertiary (LOW confidence — assumed)

- tsdown shebang preservation behavior (A1 — needs Plan 02-04 verification step)
- Strict-TS gap size on `@godoo/client` (A2 — known by grep, not by running tsc)

## Metadata

**Confidence breakdown:**
- Source package shapes: HIGH — every file read directly
- Toolchain conversion delta: HIGH — `_example` is the locked reference, mirrored field-by-field
- Jest→vitest conversion: HIGH — verified by grep across all test files (zero `jest.*` matches)
- Strict-TS gaps: MEDIUM — `any` count verified by grep; the long-tail inferred-return-type fixes are surface-area-unknown until `tsc --noEmit` runs
- Integration test reactivation: HIGH — source globalSetup.ts read directly; testcontainers API surface read directly; the new globalSetup design follows directly from the substitution
- CI workflow design: HIGH — existing CI yaml read; D-04/D-05 explicit
- Plan slicing: HIGH — dependency graph is unambiguous (D-06 locks the order)
- Phase-1 landmines: HIGH — `01-VERIFICATION.md` enumerates them

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (30 days — source code is on a tagged baseline; no fast-moving libraries in scope)

## RESEARCH COMPLETE
