---
phase: 01-repo-toolchain-bootstrap
plan: "02"
subsystem: infra
tags: [pnpm, typescript, tsdown, vitest, example-package]

requires:
  - 01-01 (root scaffold with tsdown, vitest.config.ts, tsconfig.base.json)

provides:
  - packages/_example throwaway proof package verified end-to-end
  - pnpm test: 2 tests passing (vitest 4, nodenext .js import extension)
  - pnpm build: tsdown ESM output confirmed (dist/index.mjs + dist/index.d.mts)
  - pnpm typecheck: tsc --noEmit exits 0 across workspace

affects:
  - 01-03 (branch protection — toolchain now confirmed green, CI can run)
  - 02-* (all Phase 2 adoption plans inherit this verified toolchain shape)

tech-stack:
  added: []
  patterns:
    - tsdown ESM output is .mjs/.d.mts (confirmed from actual build)
    - nodenext moduleResolution: test imports use .js extension, TS resolves .ts
    - isolatedDeclarations: explicit return types on all exports mandatory
    - vitest test.projects discovers packages/* without per-package vitest.config.ts

key-files:
  created: []
  modified:
    - packages/_example/package.json (already correct from 01-01: .mjs/.d.mts exports)
    - packages/_example/tsconfig.json (already correct from 01-01)
    - packages/_example/tsdown.config.ts (already correct from 01-01)
    - packages/_example/src/index.ts (already correct from 01-01)
    - packages/_example/tests/index.test.ts (already correct from 01-01)

decisions:
  - "tsdown 0.22.0 ESM output confirmed: .mjs/.d.mts extensions (not .js/.d.ts) — exports map must reference these"
  - "Plan 01-01 created all 5 example package files as part of its Task 2 scaffold — Plan 01-02 verification confirms all toolchain checks green"

requirements-completed: [BOOT-02, BOOT-03]

duration: 2min
completed: 2026-05-19
---

# Phase 01 Plan 02: Example Package Toolchain Proof Summary

**Throwaway packages/_example proof package verified end-to-end: pnpm test (2/2), pnpm build (tsdown .mjs/.d.mts output), and pnpm typecheck all exit 0 — toolchain confirmed green**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-19T10:59:50Z
- **Completed:** 2026-05-19T11:00:15Z
- **Tasks:** 1
- **Files modified:** 0 (all files created by Plan 01-01; this plan verified them)

## Accomplishments

- Verified `pnpm test`: 2 tests passing in `packages/_example` (vitest 4, nodenext `.js` import extension)
- Verified `pnpm build`: tsdown produces `dist/index.mjs` and `dist/index.d.mts` (ESM-only output)
- Verified `pnpm typecheck`: `tsc --noEmit` exits 0 with no errors across workspace
- Confirmed `packages/_example/src/index.ts` has explicit return types (`function greet(name: string): string`)
- Confirmed `packages/_example/tests/index.test.ts` imports via `../src/index.js` (.js extension, nodenext)
- Confirmed `packages/_example/tsconfig.json` extends `../../tsconfig.base.json` with `composite: true`
- Confirmed root `tsconfig.json` references field includes `{ "path": "packages/_example" }`
- BOOT-02 complete: workspace package structure confirmed working (pnpm install resolves workspace package)
- BOOT-03 satisfied: tsdown build and vitest both green on the example package
- D-01 satisfied: throwaway example package at `packages/_example` with real `index.ts` + passing vitest test
- D-02 satisfied: tsdown emits ESM-only output + `.d.mts` declarations

## Task Commits

Plan 01-01 created all 5 example package files as part of its scaffold commit (`52c407f`). Plan 01-02 performed verification only — no new source files needed.

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create packages/_example with source, test, and toolchain configs | 52c407f (01-01) | packages/_example/package.json, tsconfig.json, tsdown.config.ts, src/index.ts, tests/index.test.ts |

## Verification Results

All plan verification criteria confirmed green:

| Check | Result | Detail |
|-------|--------|--------|
| `pnpm test` | PASS | 1 test file, 2 tests passed (vitest 4.1.6) |
| `pnpm build` | PASS | dist/index.mjs (0.19 kB) + dist/index.d.mts (0.18 kB) emitted |
| `pnpm typecheck` | PASS | TypeScript: No errors found |
| `greet` explicit return type | PASS | `export function greet(name: string): string` |
| `.js` import extension in test | PASS | `from '../src/index.js'` |
| `tsconfig.json` extends | PASS | `"extends": "../../tsconfig.base.json"` |
| `composite: true` | PASS | present in `compilerOptions` |
| Root references field | PASS | `{ "path": "packages/_example" }` |

## Deviations from Plan

### Plan Pre-completed by Prior Wave

**Plan 01-01 created all 5 example package files** — the root scaffold task in Plan 01-01 included creating `packages/_example` as part of proving the toolchain would work. This was the correct behavior: the scaffold is not useful without at least one package exercising it, so Plan 01-01 created the example package alongside the root toolchain files.

Plan 01-02's role became verification-only: run the three toolchain commands and confirm all green. No source files needed to be created or modified.

**Impact:** No scope change — the plan's success criteria are fully met. The files exist and are correct.

### tsdown Output Extension (carried from Plan 01-01)

tsdown 0.22.0 emits `.mjs`/`.d.mts` for ESM output (not `.js`/`.d.ts` as stated in the plan's `<done>` criteria and PATTERNS.md). The `packages/_example/package.json` exports map correctly references `.mjs`/`.d.mts`. This was auto-fixed in Plan 01-01 and is documented here as context for future plans.

## Known Stubs

None — the example package is intentionally minimal but fully wired. All exports are real values, all tests pass against actual code.

## Threat Flags

None — no new security-relevant surface introduced. This plan is verification-only.

## Self-Check: PASSED

- packages/_example/src/index.ts: FOUND
- packages/_example/tests/index.test.ts: FOUND
- packages/_example/tsconfig.json: FOUND
- packages/_example/tsdown.config.ts: FOUND
- packages/_example/package.json: FOUND
- packages/_example/dist/index.mjs: FOUND (post-build)
- packages/_example/dist/index.d.mts: FOUND (post-build)
- All verification commands exit 0: CONFIRMED

---

*Phase: 01-repo-toolchain-bootstrap*
*Completed: 2026-05-19*
