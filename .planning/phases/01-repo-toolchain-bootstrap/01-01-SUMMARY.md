---
phase: 01-repo-toolchain-bootstrap
plan: "01"
subsystem: infra
tags: [pnpm, typescript, tsdown, biome, lefthook, vitest, changesets, github-actions]

requires: []
provides:
  - Public godoo-dev/godoo-ts GitHub repository, wired to local origin
  - pnpm@11 workspace root scaffold with all devDependencies pinned
  - Shared tsconfig.base.json (TS6, nodenext, isolatedDeclarations)
  - Biome single lint+format tool enforcing no-any (noExplicitAny=error)
  - lefthook pre-commit hook running Biome on staged files
  - vitest root test.projects config for monorepo
  - changesets config wired to main branch with @godoo/ public access
  - GitHub Actions CI matrix on Node 22+24 (Ubuntu)
  - packages/_example throwaway proof package (tsdown build + vitest tests green)
affects:
  - 01-02 (example package proof — creates this package; plan 02 exercises it further)
  - 01-03 (GitHub branch protection — reads CI job names from ci.yml)
  - 02-* (all Phase 2 package adoption plans use this toolchain scaffold)

tech-stack:
  added:
    - pnpm@11.1.3 (workspace manager)
    - typescript@6.0.3
    - tsdown@0.22.0 (ESM-first bundler, replaces tsup)
    - "@biomejs/biome@2.4.15 (lint+format)"
    - lefthook@2.1.7 (git hooks)
    - vitest@4.1.6 (test runner)
    - "@changesets/cli@2.31.0"
    - "@changesets/changelog-github@0.7.0"
    - "@tsconfig/node22@22.0.5"
    - "@types/node@25.8.0"
  patterns:
    - pnpm-workspace.yaml declares packages/* glob
    - tsconfig.base.json shared by all packages via extends
    - tsconfig.json (root) is references-only (files: [])
    - biome.json at root covers all packages; VCS integration via .gitignore
    - lefthook pre-commit auto-fixes and re-stages with stage_fixed: true
    - vitest root uses test.projects not deprecated vitest.workspace.ts
    - tsdown emits .mjs + .d.mts for ESM-only output

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
    - tsconfig.base.json
    - tsconfig.json
    - biome.json
    - lefthook.yml
    - vitest.config.ts
    - .gitignore
    - README.md
    - .changeset/config.json
    - .github/workflows/ci.yml
    - packages/_example/package.json
    - packages/_example/tsconfig.json
    - packages/_example/tsdown.config.ts
    - packages/_example/src/index.ts
    - packages/_example/tests/index.test.ts
  modified:
    - CLAUDE.md (verified @-import only — not modified per D-10)

key-decisions:
  - "Biome 2.4.15 schema changed from PATTERNS.md: organizeImports moved to assist.actions.source; files.ignore renamed to files.includes with negation; VCS integration enabled to use .gitignore"
  - "tsdown emits .mjs/.d.mts (not .js/.d.ts) — example package.json exports updated to match actual output"
  - "pnpm 11 requires explicit allowBuilds approval for packages with postinstall scripts — lefthook: true added to pnpm-workspace.yaml"
  - "GitHub repo creation triggered a remote initial commit (LICENSE) — merged into main with --allow-unrelated-histories, then merged into develop"

patterns-established:
  - "Biome 2.x: organizeImports lives in assist.actions.source.organizeImports (not top-level organizeImports)"
  - "Biome 2.x: use files.includes with negation patterns, not files.ignore"
  - "pnpm 11: set allowBuilds for packages with postinstall scripts in pnpm-workspace.yaml"
  - "tsdown ESM output: use .mjs/.d.mts extensions in exports map"

requirements-completed: [BOOT-01, BOOT-02, BOOT-04]

duration: 5min
completed: 2026-05-19
---

# Phase 01 Plan 01: Repo & Toolchain Bootstrap Summary

**Public godoo-dev/godoo-ts repo created with pnpm@11 workspace scaffold, TypeScript 6 strict config (nodenext/isolatedDeclarations), Biome lint+format enforcing no-any, lefthook pre-commit hook, vitest 4 test.projects, and a green example package (tsdown build + tests passing)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-19T10:50:35Z
- **Completed:** 2026-05-19T10:55:34Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Public `godoo-dev/godoo-ts` GitHub repo created, remote wired, both `main` and `develop` branches pushed
- Root monorepo scaffold committed with all toolchain config: pnpm, TS6, biome, lefthook, vitest, changesets, GitHub Actions CI
- `packages/_example` throwaway proof package exercises the full pipeline: `pnpm install --frozen-lockfile`, `biome check .`, `tsc --noEmit`, `tsdown build`, and `vitest run` all exit 0
- BOOT-04 satisfied: `CLAUDE.md` `@`-imports `../godoo-hq/UMBRELLA_CLAUDE.md` and path resolves from repo root
- lefthook pre-commit hook registered and running (intercepted the Task 2 commit successfully)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub repo, wire remote, push main + develop** - `1fb8561` / `e0bb1ff` (chore — repo operations, no new files; merge commits handling LICENSE from gh repo create)
2. **Task 2: Write root scaffold files and install dependencies** - `52c407f` (chore)

**Plan metadata:** pending (committed with STATE.md update)

## Files Created/Modified

- `package.json` - pnpm@11.1.3 workspace root, pinned devDependencies, scripts
- `pnpm-workspace.yaml` - packages/* workspace declaration, lefthook allowBuilds: true
- `pnpm-lock.yaml` - generated lockfile (lockfile-discipline compliant)
- `tsconfig.base.json` - TS6 strict config: nodenext, isolatedDeclarations, types:["node"]
- `tsconfig.json` - root references-only config (files: [])
- `biome.json` - Biome 2.4.15 with VCS integration, noExplicitAny: error, assist.actions.source.organizeImports
- `lefthook.yml` - pre-commit biome check on staged files, stage_fixed: true
- `vitest.config.ts` - root test.projects: ['packages/*']
- `.gitignore` - node_modules, dist, coverage, pnpm-debug.log*
- `README.md` - minimal project description
- `.changeset/config.json` - baseBranch: main, access: public, @godoo/ scope
- `.github/workflows/ci.yml` - Node 22+24 Ubuntu matrix CI
- `packages/_example/package.json` - @godoo/example, private, type: module, .mjs exports
- `packages/_example/tsconfig.json` - extends tsconfig.base.json, composite: true
- `packages/_example/tsdown.config.ts` - ESM-only build, dts: true, clean: true
- `packages/_example/src/index.ts` - greet() + VERSION with explicit return types
- `packages/_example/tests/index.test.ts` - 2 passing vitest tests

## Decisions Made

- **Biome 2.4.15 schema changes:** PATTERNS.md was based on an older Biome version. In 2.4.15, `organizeImports` moved to `assist.actions.source.organizeImports`, `files.ignore` was renamed to `files.includes` (with negation patterns like `!**/dist`), and VCS integration (`useIgnoreFile: true`) was added. Auto-fixed via `pnpm biome check --write .` after discovering schema errors.
- **tsdown output extensions:** tsdown 0.22.0 emits `.mjs` and `.d.mts` for ESM output (not `.js`/`.d.ts`). Updated `packages/_example/package.json` exports map to reference the correct extensions.
- **pnpm 11 allowBuilds:** pnpm 11 introduced explicit build approval for postinstall scripts. Added `allowBuilds: { lefthook: true }` to `pnpm-workspace.yaml` (lefthook postinstall is benign — installs the git hook binary).
- **GitHub repo LICENSE merge:** `gh repo create --license LGPL-3.0` creates an "Initial commit" on the remote. Merged into local `main` with `--allow-unrelated-histories`, then merged into `develop`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome 2.4.15 schema incompatibility with PATTERNS.md config**
- **Found during:** Task 2 (Write root scaffold files)
- **Issue:** PATTERNS.md target shape used `organizeImports` (top-level) and `files.ignore` — both removed/renamed in Biome 2.x. `pnpm biome check .` exited 1 with schema errors.
- **Fix:** Ran `pnpm biome init` to generate reference config, identified correct keys, rewrote `biome.json` with VCS integration, `assist.actions.source.organizeImports`, and `files.includes` negation patterns. Ran `pnpm biome check --write .` to auto-fix formatting in generated files.
- **Files modified:** `biome.json`, `packages/_example/src/index.ts`, `packages/_example/tests/index.test.ts`, `packages/_example/tsdown.config.ts`, `vitest.config.ts`, `tsconfig.json`
- **Verification:** `pnpm biome check .` exits 0, 12 files checked, no fixes applied
- **Committed in:** `52c407f` (Task 2 commit)

**2. [Rule 1 - Bug] tsdown ESM output uses .mjs/.d.mts not .js/.d.ts**
- **Found during:** Task 2 (build verification)
- **Issue:** PATTERNS.md and the plan specified `./dist/index.js` and `./dist/index.d.ts` in the exports map, but tsdown 0.22.0 emits `index.mjs` and `index.d.mts` for ESM format.
- **Fix:** Updated `packages/_example/package.json` exports map and main/types fields to use `.mjs`/`.d.mts` extensions.
- **Files modified:** `packages/_example/package.json`
- **Verification:** `pnpm build` succeeds, `pnpm test` passes (2/2 tests)
- **Committed in:** `52c407f` (Task 2 commit)

**3. [Rule 3 - Blocking] pnpm 11 requires explicit allowBuilds for lefthook postinstall**
- **Found during:** Task 2 (pnpm install)
- **Issue:** pnpm 11 blocks packages with postinstall scripts by default (`ERR_PNPM_IGNORED_BUILDS`). `pnpm install` failed on lefthook's binary installer.
- **Fix:** Added `allowBuilds: { lefthook: true }` to `pnpm-workspace.yaml`. lefthook's postinstall is a benign binary download — approved per T-01-SC slopcheck disposition.
- **Files modified:** `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- **Verification:** `pnpm install --frozen-lockfile` exits 0; lefthook postinstall runs and registers pre-commit hook
- **Committed in:** `52c407f` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. The Biome schema and tsdown extension deviations are version-specific findings that should update the PATTERNS.md for future reference.

## Issues Encountered

- GitHub repo creation via `gh repo create --license LGPL-3.0` creates an "Initial commit" on the remote, causing a push rejection on the initial `git push -u origin main`. Resolved by fetching the remote and merging with `--allow-unrelated-histories`.
- Only `develop` branch existed locally (no `main`). Created `main` locally from current `develop` state before pushing.

## User Setup Required

None - no external service configuration required. The GitHub repo is public and no secrets are needed for Plan 01.

## Next Phase Readiness

- Toolchain fully green: `pnpm install --frozen-lockfile`, `biome check .`, `tsc --noEmit`, `tsdown build`, and `vitest run` all exit 0 on `develop`
- GitHub Actions CI will run on the pushed `develop` branch (first CI run needed before Plan 03 can create the branch protection ruleset — RESEARCH.md Pitfall 6)
- `packages/_example` is ready to be verified by Plan 02 (BOOT-03 proof), then deleted in Phase 2
- No blockers for Plan 02

## Known Stubs

None — the example package is intentionally minimal but fully wired. All exports are real, all tests pass against actual code.

## Threat Flags

None — no new security-relevant surface beyond what the plan's threat model covers.

---

*Phase: 01-repo-toolchain-bootstrap*
*Completed: 2026-05-19*
