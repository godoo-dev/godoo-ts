---
phase: 02-core-3-adoption-rename
plan: 02
type: summary
subsystem: testcontainers
tags:
  - typescript
  - pnpm
  - tsdown
  - vitest
  - testcontainers
  - docker
  - workspace-deps
requires:
  - "@godoo/client (Wave 1 — provides Domain/RpcArg types and workspace package for workspace:* link)"
provides:
  - "@godoo/testcontainers (workspace package) — Docker/Odoo container lifecycle for integration tests"
  - "OdooPresets typed via OdooPresetsApi interface (explicit Promise<StartedOdooContainer> returns)"
  - "Per-package vitest.config.ts pattern with 600s container timeouts + defensive integration-test exclude"
affects:
  - "packages/testcontainers (new)"
  - "tsconfig.json (references[] now [client, testcontainers])"
  - "pnpm-workspace.yaml (allowBuilds placeholders -> false)"
  - "pnpm-lock.yaml (workspace:* link + transitive deps)"
tech_stack:
  added:
    - "dockerode ^4.0.0 (transitive: cpu-features, ssh2)"
    - "testcontainers ^10.13.2"
    - "@testcontainers/postgresql ^10.13.2"
    - "@types/dockerode ^3.3.23"
  patterns:
    - "OdooPresetsApi interface to satisfy rolldown-plugin-dts isolatedDeclarations on object-literal lambdas (same pattern as Plan 02-01 deviation #7)"
    - "workspace:* in BOTH dependencies and peerDependencies (per RESEARCH §V6 — peer kept for Phase 3 downstream npm consumers; changesets resolves to concrete range at publish)"
    - "Defensive per-package vitest.config.ts exclude (belt-and-suspenders for root vitest workspace projects: ['packages/*'] semantics)"
    - "if-not-undefined narrowing guard (replaces let odoo: any in integration tests) to satisfy strict mode without sacrificing test ergonomics"
key_files:
  created:
    - "packages/testcontainers/package.json"
    - "packages/testcontainers/tsconfig.json"
    - "packages/testcontainers/tsdown.config.ts"
    - "packages/testcontainers/vitest.config.ts"
    - "packages/testcontainers/README.md"
    - "packages/testcontainers/LICENSE"
    - "packages/testcontainers/src/ (13 .ts files)"
    - "packages/testcontainers/tests/ (7 .ts files: 3 integration + 3 unit/provisioner + 1 fixture)"
  modified:
    - "tsconfig.json (references[] appended)"
    - "pnpm-workspace.yaml (allowBuilds placeholders -> false booleans)"
    - "pnpm-lock.yaml"
decisions:
  - "D-01 honored: plain-copy whitelist from odoo-toolbox at pre-adoption-baseline (re-used Wave 1 tag — SHA 9523f00f19); single adoption commit references source SHA; no git subtree."
  - "D-03 honored: zero @ts-ignore / @ts-nocheck / biome-ignore in adopted code; Domain reused from @godoo/client; all workspace gates green."
  - "D-06 honored: testcontainers adopted SECOND (wave 2, depends_on: 02-01); client integration tests still describe.skip-wrapped (10 occurrences unchanged); reactivation deferred to 02-03."
  - "Claude's Discretion (RESEARCH §V6): peerDependencies['@godoo/client'] retained as workspace:* (not dropped) — preserves a peer for downstream Phase-3 npm consumers; changesets handles version resolution at publish."
  - "allowBuilds disposition: cpu-features, protobufjs, ssh2 set to false explicitly. These are transitive deps of dockerode/testcontainers. Phase-1 left them as 'set this to true or false' placeholders which broke pnpm install exit-0; bool conversion was a Rule 3 blocking fix. JS-only fallbacks suffice for typecheck/build/unit tests; Phase 02-03+ may revisit for real Docker integration."
metrics:
  duration_minutes: 60
  completed: "2026-05-21"
  source_sha: "9523f00f19"
  adoption_commit: "c9a2225"
  files_created: 26
  files_modified: 3
  src_ts_files: 13
  test_ts_files: 7
  any_count_before_in_src: 12
  any_count_after_in_src: 0
  unit_tests_passing: 228
  tests_skipped: 136
---

# Phase 2 Plan 02: Adopt @godoo/testcontainers Summary

`@marcfargas/odoo-testcontainers@0.1.5` adopted as `@godoo/testcontainers@0.1.5` in one
`feat(testcontainers)` commit on `develop`. Wave 2 of Phase 2; builds on Wave 1's
`@godoo/client` to validate the cross-package `workspace:*` resolution mechanic.

## What was built

- **`packages/testcontainers/`** — full Docker/Odoo container lifecycle module
  lifted from `C:\dev\odoo-toolbox\packages\odoo-testcontainers\` at the
  `pre-adoption-baseline` tag (`odoo-toolbox@9523f00f19`):
  - 13 source `.ts` files under `src/` (`index`, `odoo-container`, `presets`,
    `version`, `snapshot-cache`, `provisioners/{harness,modules,partners,projects,
    properties,users,types,index}`)
  - 7 test `.ts` files under `tests/` (3 `*.integration.test.ts` excluded from
    `pnpm test` by both root vitest config and defensive per-package config; 3
    unit/provisioner `*.test.ts` running clean; 1 `shared-odoo-container.ts`
    fixture)
  - `README.md` (rewritten to `@godoo/testcontainers` namespace), `LICENSE`
    (LGPL-3.0 carried from sibling `packages/client/LICENSE` — source repo has
    no per-package LICENSE), fresh `package.json` + `tsconfig.json` +
    `tsdown.config.ts` + `vitest.config.ts` per PATTERNS.md
- **`packages/testcontainers/vitest.config.ts`** — 600s container timeouts
  PLUS defensive `exclude: ['**/*.integration.test.ts', '**/node_modules/**',
  '**/dist/**']` (belt-and-suspenders for root vitest workspace projects:
  ['packages/*'] override semantics).
- **`packages/testcontainers/src/presets.ts`** — `OdooPresetsApi` interface
  defined and applied to `OdooPresets` constant so every preset lambda carries
  an explicit `Promise<StartedOdooContainer>` return type. Without this,
  rolldown-plugin-dts trips `TS9007: Function must have an explicit return
  type annotation with --isolatedDeclarations` on the bare arrow expressions
  in the object literal.
- **Root `tsconfig.json`** updated: `references[] = [{packages/client}, {packages/testcontainers}]`.
- **`pnpm-workspace.yaml`** updated: `cpu-features`, `protobufjs`, `ssh2`
  allowBuilds set to `false` (placeholder strings blocked `pnpm install` exit-0).
- **`pnpm-lock.yaml`** regenerated and committed alongside per
  lockfile-discipline rule (146 packages added, 3 removed — testcontainers,
  @testcontainers/postgresql, dockerode, debug were already at the workspace
  root from Phase 1, but their transitive trees now resolve).

## Source SHA referenced

Commit subject embeds source provenance per D-01:

> `feat(testcontainers): adopt @marcfargas/odoo-testcontainers as @godoo/testcontainers (from odoo-toolbox@9523f00f19)`

The `pre-adoption-baseline` tag at `9523f00f19` is shared with Plan 02-01;
Plan 02-02 re-verified the tag still exists and source repo working tree is
unchanged.

## workspace:* link verification

```
$ pnpm --filter @godoo/testcontainers list @godoo/client
@godoo/testcontainers@0.1.5 C:\dev\godoo-dev\godoo-ts\packages\testcontainers
│
│   dependencies:
└── @godoo/client@link:../client
```

The `workspace:*` specifier resolves to a `link:` entry in pnpm's symlink
graph — `packages/testcontainers/node_modules/@godoo/client` is a junction
into `packages/client/`. This validates the cross-package adoption mechanic
that Plan 02-04 (introspection) will reuse.

## Strict-TS pass outcomes (D-03)

RESEARCH.md identified 2 source-code `any` lines in `provisioners/types.ts`.
The actual scan found 12 `any` lines across 5 source files (RESEARCH undercounted
the `Record<string, any>` write-payload bags in `provisioners/{partners,projects,
properties,users}.ts`). Same scope-expansion pattern as Plan 02-01 deviation #1.

| File | Before | After | Notes |
|------|-------:|------:|-------|
| `src/provisioners/types.ts` | 9 | 0 | Imported `Domain` from `@godoo/client`; replaced `any[]` → `Domain`, `Record<string, any>` → `Record<string, unknown>`, `T extends Record<string, any>` → `T extends Record<string, unknown>` |
| `src/provisioners/partners.ts` | 1 | 0 | `Record<string, any>` → `Record<string, unknown>` (write-payload bag) |
| `src/provisioners/projects.ts` | 1 | 0 | Same |
| `src/provisioners/properties.ts` | 2 | 0 | Same (both signature + variable) |
| `src/provisioners/users.ts` | 1 | 0 | Same |
| `src/presets.ts` (D-03 add — isolatedDeclarations) | n/a | n/a | Added `OdooPresetsApi` interface with explicit `Promise<StartedOdooContainer>` on every preset method, plus explicit return-type annotations on each lambda |
| `tests/provisioners/harness.test.ts` | 1 | 0 | `[] as any[]` → `[] as unknown[]` |
| `tests/provisioners/projects.test.ts` | 2 | 0 | Same + `Record<string, any>` → `Record<string, unknown>` |
| `tests/quick-test.integration.test.ts` | 1 | 0 | `let odoo: any` → `let odoo: StartedOdooContainer \| undefined` + `if (!odoo) throw` narrowing guards |

**Suppressions: zero `@ts-ignore` / `@ts-nocheck` / `biome-ignore` lines** in
`packages/testcontainers/src/` (verified by `git grep -nE`).

## Verification gate results

| Gate | Command | Result |
|------|---------|--------|
| Source SHA + clean tree | `git -C /c/dev/odoo-toolbox rev-parse --short=10 HEAD && tag -l pre-adoption-baseline && status --porcelain` | `9523f00f19`, tag present, empty status — D-01 satisfied |
| Workspace install | `pnpm install` | Exit 0 after allowBuilds bool conversion; `pnpm-lock.yaml` updated and committed alongside |
| Frozen lockfile | `pnpm install --frozen-lockfile` | Exit 0 (CI-equivalent gate) |
| Lint/format | `pnpm biome check .` | Exit 0; 5 warnings + 9 infos (style advisories on `noNonNullAssertion`, `useLiteralKeys`, `useNodejsImportProtocol` — non-blocking; Biome treats these as warnings/infos, not errors) |
| Typecheck (full workspace) | `pnpm tsc --noEmit` | Exit 0; strict + isolatedDeclarations + noUncheckedIndexedAccess all satisfied |
| Build | `pnpm build` | Exit 0; emits `packages/client/dist/index.mjs` (122 kB) AND `packages/testcontainers/dist/index.mjs` (30 kB) + `.d.mts` counterparts |
| Unit tests | `pnpm test` | Exit 0; 228 passed across 14 test files (12 client unit + 2 testcontainers provisioner + 1 testcontainers snapshot-cache unit). 136 skipped (10 client integration `describe.skip` + cdc inner block). Integration tests in `packages/testcontainers/tests/*.integration.test.ts` NOT discovered (per-package vitest config exclude works under `projects: ['packages/*']`) |
| Cross-package workspace dep | `pnpm --filter @godoo/testcontainers list @godoo/client` | `@godoo/client@link:../client` — workspace:* resolution verified |
| Zero `@marcfargas/odoo-*` in testcontainers | `grep -rE "@marcfargas/odoo-" packages/testcontainers/` | exit 1 (no matches) — CORE-05 verifier clean for this package |
| Defensive vitest exclude | `grep -F "'**/*.integration.test.ts'" packages/testcontainers/vitest.config.ts` | Match found |
| 10 `describe.skip` unchanged | `grep -c "describe.skip" packages/client/tests/*.integration.test.ts \| awk` | 10 (Wave-1 invariant preserved) |
| Commit subject regex | `git log -1 --format=%s \| grep -E '...'` | OK — matches `feat(testcontainers): adopt @marcfargas/odoo-testcontainers as @godoo/testcontainers (from odoo-toolbox@9523f00f19)` |
| Co-author trailer | `git log -1 --format=%b \| grep Co-Authored-By` | Present |

## Deviations from plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Strict-TS pass scope wider than RESEARCH.md estimate (same pattern as Plan 02-01 dev #1)**
- **Found during:** Task 2 (strict-TS sweep)
- **Issue:** RESEARCH.md projected 2 `any` source lines in `provisioners/types.ts`. Actual scan returned 12 `any` source lines (RESEARCH counted only `any[]` and `Record<string, any>` literals in `types.ts`; missed the same pattern across the four other provisioners' write-payload bags). Workspace-level Biome `noExplicitAny: error` (Phase-1 D-03) rejects all of them, and D-03 forbids any relaxation.
- **Fix:** Replaced every `any` (excluding JSDoc/comment matches) with `unknown`, `Domain` (re-imported from `@godoo/client`), or narrowed local types. Same iteration-to-green protocol Plan 02-01 used.
- **Files modified:** `src/provisioners/{types,partners,projects,properties,users}.ts`, `tests/provisioners/{harness,projects}.test.ts`, `tests/quick-test.integration.test.ts`
- **Commit:** c9a2225

**2. [Rule 3 - Blocking] rolldown-plugin-dts stricter than `tsc --noEmit` on `isolatedDeclarations` (same pattern as Plan 02-01 dev #7)**
- **Found during:** Task 3 (`pnpm build` after `tsc --noEmit` passed)
- **Issue:** `pnpm tsc --noEmit` accepted `OdooPresets = { standard: () => startOdoo({...}), ... }` because the lambdas' returns are inferred from `startOdoo`. rolldown-plugin-dts (used by tsdown) requires explicit return type annotations on every function in an exported binding when `isolatedDeclarations: true`. Failed with `TS9007: Function must have an explicit return type annotation with --isolatedDeclarations`.
- **Fix:** Introduced `OdooPresetsApi` interface with explicit `Promise<StartedOdooContainer>` return types for every preset method, then typed `OdooPresets: OdooPresetsApi = {...}` and added explicit return-type annotations on each lambda. Same shape Plan 02-01 used for `READ_METHODS` / `DELETE_METHODS` in `safety/index.ts`.
- **Files modified:** `src/presets.ts`
- **Commit:** c9a2225

**3. [Rule 3 - Blocking] `pnpm-workspace.yaml` allowBuilds placeholders blocked `pnpm install` exit 0**
- **Found during:** Task 3 (first `pnpm biome check .` after install)
- **Issue:** Phase-1 / Plan 02-01 left `cpu-features`, `protobufjs`, `ssh2` (transitive deps of dockerode/testcontainers introduced by 02-01) in `pnpm-workspace.yaml.allowBuilds` with literal placeholder strings `"set this to true or false"`. pnpm 11 sees these as ambiguous and exits with `ERR_PNPM_IGNORED_BUILDS` from any deps-status precheck. `pnpm biome check .` runs a deps check first → propagated exit 1 → entire gate chain blocked.
- **Fix:** Set the three placeholders to literal `false` (matching the prior runtime behavior — no postinstall scripts executed — but now explicit). The packages are well-known dockerode/testcontainers transitives; the JS-only fallback paths suffice for typecheck/build/unit tests. Documented in the YAML comment that Phase 02-03+ may need to revisit for real Docker integration tests.
- **Files modified:** `pnpm-workspace.yaml`
- **Commit:** c9a2225
- **Threat-model link:** T-02-02-SC explicitly stated "If pnpm install (Task 3) prompts an allowBuilds (postinstall script) for any transitively new dep, that's caught by the Phase-1 D-03 lockdown — escalate to user before approving." No NEW dep was introduced (all three were already in the lockfile from 02-01); the placeholders were a Phase-1 carryover artifact that Plan 02-01 did not address because client's transitive tree did not hit the same precheck failure path until pnpm v11.1.3's stricter behavior surfaced it here. Setting to `false` keeps the security posture identical to what 02-01 ran under in practice.

**4. [Documentation] Verbose-reporter integration-test count acceptance criterion**
- **Found during:** Task 3 final verification gate
- **Issue:** Plan T3 acceptance criterion: `pnpm test --reporter=verbose 2>&1 | grep -v '^#' | grep -c '\.integration\.test\.ts'` equals 0. Actual count: 125. All 125 matches are `@godoo/client`'s integration tests that the Wave-1 `describe.skip` wrapping keeps in vitest's discovery (vitest verbose-reporter still prints the file path and individual `it()` rows with the ↓ skipped glyph). The plan's intent was to confirm the testcontainers per-package `exclude` works — and it does: zero `|testcontainers|`-tagged `.integration.test.ts` rows appear in the output.
- **Resolution:** Not a code defect — acceptance criterion was over-literal vs. plan intent. Documenting here. The functional invariant ("testcontainers integration tests not discovered under `pnpm test`") is verified by `grep '\.integration\.test\.ts' | grep testcontainers | wc -l == 0`.

### Architectural changes

None — every fix landed inside the plan's declared scope. The
`pnpm-workspace.yaml` edit is a workspace-config tweak, not an architectural
change.

### Authentication gates

None.

## Hand-off notes for Plan 02-03

- **`@godoo/testcontainers` is now consumable for client integration setup.**
  Plan 02-03 should:
  - Add `packages/client/tests/integration-setup.ts` exporting
    `setup`/`teardown` that call `startOdoo({...})` from `@godoo/testcontainers`
    and seed `process.env.ODOO_URL` / `ODOO_DB_NAME` / `ODOO_DB_USER` /
    `ODOO_DB_PASSWORD` (per RESEARCH §"Integration-Test Reactivation").
  - Add `packages/client/vitest.integration.config.ts` with
    `globalSetup: './tests/integration-setup.ts'`, `testTimeout: 600_000`,
    `hookTimeout: 600_000`, `sequence: { concurrent: false }`, `pool: 'forks'`,
    `fileParallelism: false`.
  - Add `packages/client` devDependency `@godoo/testcontainers: workspace:*`
    (test-only — testcontainers does not need to be a runtime dep of client).
  - Delete the 10 `describe.skip` + the 10 `// TODO(CORE-03)` markers in
    `packages/client/tests/*.integration.test.ts` (delta from Plan 02-01).
  - Wire `pnpm test:integration` script + GitHub Actions `integration` CI job
    per RESEARCH §"Integration CI Workflow Design".
- **The `OdooPresets` API exports a real value bound to `OdooPresetsApi`** —
  Plan 02-03's integration tests can call e.g. `OdooPresets.standard()` or
  `OdooPresets.hr()` and get a typed `Promise<StartedOdooContainer>`.
- **`OdooContainerCleanup` is via `startedContainer.cleanup()`** — exposed on
  the `StartedOdooContainer` return shape; `teardown()` in integration-setup
  should call this.
- **Defensive vitest exclude pattern works.** If Plan 02-03 introduces a
  per-package `vitest.config.ts` for the client (it should — for the
  integration suite), follow the same shape: include the integration tests
  via `include`, set timeouts, and rely on the workspace root's exclude to
  keep `pnpm test` (unit) clean.
- **rolldown-plugin-dts isolatedDeclarations is still stricter than tsc.**
  Plan 02-04 (introspection) will hit this on `src/codegen/*` exports —
  every exported function / const / class needs an explicit return type
  annotation. Pre-add them when copying source.
- **allowBuilds posture is `false` for cpu-features / protobufjs / ssh2.**
  Plan 02-03 runs real Docker via testcontainers — these flags control
  *postinstall native-build* steps, not runtime usage. Dockerode and the
  `testcontainers` package work via the host Docker daemon TCP/named-pipe
  socket regardless of these native modules (they're optional accelerators
  for cpu-features and ssh2). If 02-03's integration runs hit "module not
  found"-style errors for these, the fix is to flip the relevant flag to
  `true` and re-run `pnpm install`.

## Self-Check: PASSED

- Commit `c9a2225c16578b3ce747ef120e5f65959cc3248b` exists on `develop`
- `packages/testcontainers/package.json` is `@godoo/testcontainers@0.1.5`
- `packages/testcontainers/package.json.dependencies["@godoo/client"]` is `workspace:*`
- `packages/testcontainers/package.json.peerDependencies["@godoo/client"]` is `workspace:*`
- `packages/testcontainers/dist/index.mjs` + `index.d.mts` produced by build
- `pre-adoption-baseline` tag still exists at `odoo-toolbox@9523f00f19`
- `pnpm install --frozen-lockfile` + biome + tsc + build + test all exit 0 post-commit
- Zero `@marcfargas/odoo-*` strings in `packages/testcontainers/`
- `pnpm --filter @godoo/testcontainers list @godoo/client` shows `link:../client`
- 10 `describe.skip` in `packages/client/tests/*.integration.test.ts` unchanged
- Commit subject matches the `feat(testcontainers): adopt @marcfargas/odoo-testcontainers as @godoo/testcontainers (from odoo-toolbox@<sha>)` regex
- Co-Authored-By trailer present
