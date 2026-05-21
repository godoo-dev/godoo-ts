---
phase: 02-core-3-adoption-rename
verified: 2026-05-21T13:30:00Z
status: passed
score: 5/5 success criteria verified
overrides_applied: 0
---

# Phase 2: Core-3 Adoption & Rename — Verification Report

**Phase Goal:** The three core Odoo libraries are adopted from `odoo-toolbox`, renamed under the `@godoo/` scope, and fully validated — including the client's integration tests against real Odoo containers.

**Verified:** 2026-05-21
**Status:** passed
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | `@godoo/client` adopted+renamed; unit tests pass | VERIFIED | `packages/client/package.json` name=`@godoo/client`, exports → `.mjs`/`.d.mts`; zero `@marcfargas/odoo-` in `packages/`; `pnpm test` exit 0 |
| SC2 | `@godoo/testcontainers` adopted+renamed; tests pass | VERIFIED | `packages/testcontainers/package.json` name=`@godoo/testcontainers`, dependency `@godoo/client`=`workspace:*`, exports → `.mjs`/`.d.mts`; `pnpm test` exit 0 |
| SC3 | Client integration tests re-enabled, CI configured to run them | VERIFIED | `packages/client/tests/integration-setup.ts` + `packages/client/vitest.integration.config.ts` present; zero `describe.skip` and zero `TODO(CORE-03)` in `packages/client/tests/*.integration.test.ts`; `.github/workflows/ci.yml` has `integration:` job on Node 22+24 matrix with `pnpm test:integration`; PR triggers include `main` and `develop` (per focus: configured-to-run is sufficient; live CI execution observed on PR open) |
| SC4 | `@godoo/introspection` adopted+renamed; tests pass | VERIFIED | `packages/introspection/package.json` name=`@godoo/introspection`, `bin.odoo-introspect=./dist/cli/cli.mjs`, dep `@godoo/client`=`workspace:*`; `head -1 src/cli/cli.ts` + `head -1 dist/cli/cli.mjs` = `#!/usr/bin/env node`; `pnpm test` exit 0 |
| SC5 | Zero `@marcfargas/odoo-*` import paths remain | VERIFIED | `git grep "@marcfargas/odoo-" -- packages/` returns 0 matches. The only remaining hits are in `SEED.md` (documentation history — rename mapping table), which is documentation outside `packages/`. |

**Score: 5/5 success criteria verified.**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|----------|--------|---------|
| `packages/client/package.json` | name=`@godoo/client`, exports `.mjs`/`.d.mts` | VERIFIED | Verified via `jq`; `main`/`types`/`exports["."].import`/`exports["."].types` all `.mjs`/`.d.mts` |
| `packages/testcontainers/package.json` | name=`@godoo/testcontainers`, dep `@godoo/client`=`workspace:*` | VERIFIED | Both dependencies and peerDependencies use `workspace:*` |
| `packages/introspection/package.json` | name=`@godoo/introspection`, bin → `dist/cli/cli.mjs`, dep `@godoo/client`=`workspace:*` | VERIFIED | All three checks pass |
| `packages/client/src/rpc/types.ts` | Canonical `Domain` and `RpcArg` exports | VERIFIED | `export type Domain = DomainClause[]` and `export type RpcArg = unknown` present |
| `packages/client/tests/integration-setup.ts` | vitest globalSetup invoking `startOdoo()` | VERIFIED | Imports `startOdoo` from `@godoo/testcontainers`, sets 7 ODOO_* env vars, no `console.*` cred logging |
| `packages/client/vitest.integration.config.ts` | Per-package integration config | VERIFIED | `globalSetup: './tests/integration-setup.ts'`, `pool: 'forks'`, `fileParallelism: false`, `sequence.concurrent: false`, 600s timeouts |
| `packages/introspection/src/cli/cli.ts` | Line 1 = `#!/usr/bin/env node` | VERIFIED | Shebang present in source |
| `packages/introspection/dist/cli/cli.mjs` | Built CLI preserves shebang | VERIFIED | Shebang preserved by tsdown in built output |
| `tsconfig.json` `references[]` | All three packages listed | VERIFIED | `[{ path: "packages/client" }, { path: "packages/testcontainers" }, { path: "packages/introspection" }]` |
| `.github/workflows/ci.yml` `integration` job | Top-level job, Node 22+24, no `services:` | VERIFIED | Present; matrix=`[22, 24]`; no services block; `TESTCONTAINERS_RYUK_DISABLED='false'`; pull_request triggers cover `main` + `develop` |
| All 8 expected dist files | `index.mjs` + `index.d.mts` × 3 packages + `cli.mjs` + `cli.d.mts` | VERIFIED | All 8 present after `pnpm build` |
| Per-package tsconfigs | `composite: true`, extend `tsconfig.base.json` | VERIFIED | All three packages match shape exactly |

---

### Key Link Verification (Wiring)

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `@godoo/client` integration tests | `@godoo/testcontainers` | `integration-setup.ts` globalSetup | WIRED | `import { startOdoo } from '@godoo/testcontainers'` resolves via workspace:* devDep |
| `@godoo/testcontainers` | `@godoo/client` | dependencies + peerDependencies | WIRED | Both fields = `workspace:*` |
| `@godoo/introspection` | `@godoo/client` | dependencies | WIRED | `workspace:*`; `Domain` type re-imported from `@godoo/client` per codegen template |
| CI `integration` job | `vitest.integration.config.ts` | `pnpm test:integration` script chain | WIRED | Root script fans out via `pnpm --filter @godoo/client --filter @godoo/testcontainers run test:integration`; per-package script `vitest run --config vitest.integration.config.ts` |
| Branch ruleset `require-ci-on-main` | CI jobs | `required_status_checks` | WIRED | 4 checks: `ci (22)`, `ci (24)`, `integration (22)`, `integration (24)`; `enforcement: active`; `non_fast_forward` retained |
| Cyclic workspace dep (client ↔ testcontainers) | pnpm resolution | `pnpm install` | WIRED | `pnpm install --frozen-lockfile` exits 0; pnpm logs cycle warning but resolves at devDeps edge (client devDeps testcontainers, never imported from `src/`) |

---

### D-NN Implementation Decisions

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 (fresh copy + `pre-adoption-baseline` tag) | VERIFIED | Tag exists in `C:\dev\odoo-toolbox`; all 3 adoption commits reference source SHA `9523f00f19` |
| D-02 (one-pass jest → vitest) | VERIFIED | Zero `jest`/`ts-jest`/`@types/jest` devDeps in any `packages/*/package.json`; all `test` scripts use `vitest run` |
| D-03 (strict-clean) | VERIFIED | Zero `@ts-nocheck` or `biome-ignore` in `packages/{client,testcontainers,introspection}/src/`; `pnpm biome check . && pnpm tsc --noEmit && pnpm build` all exit 0 |
| D-04 (integration CI on push develop/main + PR to either, Node 22+24) | VERIFIED | `.github/workflows/ci.yml` matches exactly; no path filter; no nightly cron |
| D-05 (container orchestration via `@godoo/testcontainers` only) | VERIFIED | No `services:` block; no `docker-compose*.yml` file anywhere in repo |
| D-06 (locked adoption order) | VERIFIED | 4 commits in expected order: `b0131b5` client → `c9a2225` testcontainers → `b553137` CORE-03 reactivation → `6f87dce` introspection |
| D-07 (`packages/_example` deleted in first adoption commit) | VERIFIED | `packages/_example/` does not exist on develop |

---

### Phase-1 Landmines

| Landmine | Status | Evidence |
|----------|--------|----------|
| Exports map references `.mjs`/`.d.mts` (NOT `.js`/`.d.ts`) | VERIFIED | All three packages: `main`, `types`, `exports["."].import`, `exports["."].types` end in `.mjs` or `.d.mts` |
| Per-package tsconfigs have `composite: true` and extend `../../tsconfig.base.json` | VERIFIED | All three tsconfigs match shape |
| Root `tsconfig.json` `references[]` lists all three packages | VERIFIED | Verified above |
| Introspection bin entry references `.mjs` (NOT inherited `.js`) | VERIFIED | `bin.odoo-introspect = "./dist/cli/cli.mjs"` |

---

### Whole-Workspace Gates (Run Live)

| Gate | Command | Result |
|------|---------|--------|
| Frozen-lockfile install | `pnpm install --frozen-lockfile` | Exit 0; "Already up to date" |
| Biome | `pnpm biome check .` | Exit 0 (12 warnings + 13 infos — non-fatal style advisories, pre-existing per Wave 2/3 SUMMARYs) |
| Typecheck | `pnpm tsc --noEmit` | Exit 0 |
| Build | `pnpm build` | Exit 0; emits 8 expected dist files (3 × `index.mjs` + 3 × `index.d.mts` + `cli/cli.mjs` + `cli/cli.d.mts`) |
| Unit tests | `pnpm test` | Exit 0; 262 passed + 30 skipped across 16+2 files; **integration tests NOT discovered** (root + per-package excludes work) |

---

### Branch Protection Ruleset

| Check | Expected | Actual |
|-------|----------|--------|
| `required_status_checks` | `ci (22)`, `ci (24)`, `integration (22)`, `integration (24)` | Exactly those 4 — verified via `gh api repos/godoo-dev/godoo-ts/rulesets/16586024` |
| `enforcement` | `active` | `active` |
| `non_fast_forward` | retained | retained |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CORE-01 | 02-01-PLAN | `@godoo/client` adopted+renamed; unit tests pass; integration temporarily skipped | SATISFIED | SC1 + integration tests later re-enabled per SC3 (initial skip honored at Wave 1) |
| CORE-02 | 02-02-PLAN | `@godoo/testcontainers` adopted+renamed; tests pass | SATISFIED | SC2 |
| CORE-03 | 02-03-PLAN | Client integration tests re-enabled against `@godoo/testcontainers` | SATISFIED | SC3 — re-enabled in commit `b553137`; CI job configured; per focus, live PR execution is post-phase observation |
| CORE-04 | 02-04-PLAN | `@godoo/introspection` adopted+renamed; tests pass | SATISFIED | SC4 |
| CORE-05 | All 4 plans (cumulative) | Zero `@marcfargas/odoo-*` import paths remain | SATISFIED | SC5 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/client/tests/examples.test.ts` | 17 | `TODO(02-01 whitelist)` — examples/ dir not yet restored | Info | Unit-side meta-test; describe.skip-wrapped; references the originating plan number (audit trail is intact) — not a debt blocker per gates rules (TODO is warning-level, not TBD/FIXME/XXX) |
| `packages/introspection/tests/examples.integration.test.ts` | 9 | `TODO`: enable introspection integration tests in follow-up phase | Info | Intentionally deferred per RESEARCH §"Open Question #3" (Plan 02-03 hand-off note); not a Phase-2 requirement; not a blocker |

No `TBD` / `FIXME` / `XXX` debt markers in adopted code (client, testcontainers, introspection — both `src/` and `tests/`).

---

### Observed Deviations / Non-Code Notes

1. **REQUIREMENTS.md still lists CORE-01 as "Pending".** All other CORE-0x rows are marked Complete. The CORE-01 contract ("client adopted+renamed; unit tests pass; integration tests temporarily skipped") is fully satisfied by Plan 02-01; the requirements doc was never refreshed when Plan 02-03 (which closed CORE-03) implicitly closed out CORE-01's "temporarily skipped" caveat. This is a documentation drift, not a code-level gap. Suggested housekeeping for Phase 3 entry: update REQUIREMENTS.md row for CORE-01 to "Complete".

2. **Live integration-test PR run not yet observed.** Per the verification focus ("configured to run and the job exists is sufficient"), this is acceptable. Wave 3 and Wave 4 SUMMARYs both flag the first PR open as the canonical CI validation point. The integration job is a required check — if it fails on the PR, merges are blocked and a remediation cycle starts before Phase 3.

3. **Workspace cyclic dep (`client` ↔ `testcontainers`).** pnpm logs a cycle warning during install but resolves correctly because the cycle breaks at the `devDependencies` edge. `pnpm install --frozen-lockfile` exits 0. Documented in 02-03 SUMMARY hand-off.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Workspace install | `pnpm install --frozen-lockfile` | Exit 0 | PASS |
| Lint | `pnpm biome check .` | Exit 0 | PASS |
| Typecheck | `pnpm tsc --noEmit` | Exit 0 | PASS |
| Build | `pnpm build` | Exit 0; 8 dist files emitted | PASS |
| Unit tests | `pnpm test` | Exit 0; 262 passed / 30 skipped; no integration discovery | PASS |
| Introspection CLI shebang preserved by tsdown | `head -1 packages/introspection/dist/cli/cli.mjs` | `#!/usr/bin/env node` | PASS |
| Domain type canonicalization | `grep "export type Domain" packages/client/src/rpc/types.ts` | Present | PASS |
| Branch ruleset | `gh api repos/godoo-dev/godoo-ts/rulesets/16586024` | 4 required checks, active, non_fast_forward retained | PASS |

---

### Human Verification Required

**None.** All goal-achievement evidence is verifiable from the codebase + the GitHub API. The one remaining live-observation item (first PR open running the new integration job) is explicitly flagged in the verification focus as out-of-scope for Phase-2 close and is automatically gated by branch protection — Phase 3 will surface it naturally on its first PR.

---

## Final Phase Metrics

| Metric | Value |
|--------|-------|
| Commits since phase start (`b461026..HEAD`) | 13 |
| Adoption `feat` commits (D-06 sequence) | 4 — `b0131b5`, `c9a2225`, `b553137`, `6f87dce` |
| Source SHA referenced (`odoo-toolbox`) | `9523f00f19` |
| Total files changed | 145 |
| Lines added / deleted | +24,506 / -87 |
| Packages added | 3 (`@godoo/client`, `@godoo/testcontainers`, `@godoo/introspection`) |
| `packages/_example` removed | Yes (D-07) |
| Tests passing (unit) | 262 |
| Tests skipped (unit, intentional) | 30 |
| Client integration test files re-enabled | 10 |
| `TODO(CORE-03)` markers removed | 10 |
| Branch ruleset required checks | 2 → 4 |
| `@marcfargas/odoo-` residue in `packages/` | 0 |

---

## VERIFICATION PASSED

All 5 success criteria verified. All 7 D-NN decisions honored. All Phase-1 landmines avoided. Whole-workspace gates (`pnpm install --frozen-lockfile`, `pnpm biome check .`, `pnpm tsc --noEmit`, `pnpm build`, `pnpm test`) all exit 0. Branch protection ruleset matches expected shape. Phase 2 is complete and ready for Phase 3 (Publishing & Source-Repo Shedding).

---

*Verified: 2026-05-21T13:30:00Z*
*Verifier: Claude (gsd-verifier)*
