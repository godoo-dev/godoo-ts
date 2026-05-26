---
phase: 01-repo-toolchain-bootstrap
plan: "03"
subsystem: infra
tags: [github-actions, ci, changesets, branch-protection, rulesets, pnpm]

# Dependency graph
requires:
  - phase: 01-repo-toolchain-bootstrap plan 01
    provides: repo scaffold, pnpm-workspace, lockfile committed
  - phase: 01-repo-toolchain-bootstrap plan 02
    provides: example package, vitest, tsdown build — all green locally
provides:
  - GitHub Actions CI workflow on Node 22 + Node 24 matrix (ubuntu-latest)
  - Changesets config wired to baseBranch:main with @changesets/changelog-github
  - main branch ruleset requiring ci(22) + ci(24) before merge, blocking force-push
affects:
  - Phase 2 (package adoption) — all PRs to main now gated by CI
  - Phase 3 (release pipeline) — changesets config already wired

# Tech tracking
tech-stack:
  added:
    - GitHub Actions (pnpm/action-setup@v6, actions/checkout@v4, actions/setup-node@v4)
    - "@changesets/cli 2.31.0"
    - "@changesets/changelog-github 0.7.0"
  patterns:
    - CI matrix: job named `ci` + node-version [22, 24] produces status contexts "ci (22)" / "ci (24)"
    - Branch ruleset via gh api --input POST with JSON body (--field rejects objects/arrays in PowerShell)
    - Ruleset created AFTER first CI run so check names are known to GitHub (Pitfall 6)

key-files:
  created:
    - .github/workflows/ci.yml
    - .changeset/config.json
  modified: []

key-decisions:
  - "gh api --field stringifies JSON objects causing 422; use --input - with echo/stdin for complex payloads"
  - "lefthook pinned to 2.1.6 (2.1.7 same-day publish rejected by pnpm minimumReleaseAge supply-chain policy)"
  - "CI workflow version: field removed from pnpm/action-setup@v6 (redundant — v6 pins pnpm 11 automatically)"

patterns-established:
  - "Pattern: gh api POST with JSON body uses --input - piped from echo, not --field for objects/arrays"
  - "Pattern: branch ruleset --input format: name, target, enforcement, conditions.ref_name.include, rules array"

requirements-completed:
  - BOOT-03

# Metrics
duration: 7min
completed: 2026-05-19
---

# Phase 01 Plan 03: CI Pipeline + Release Toolchain + Branch Protection Summary

**GitHub Actions CI green on Node 22+24 matrix, changesets wired to baseBranch:main, and main branch ruleset requiring ci(22)+ci(24) checks plus non_fast_forward guard**

## Performance

- **Duration:** ~7 min (continuation agent — Task 3 only; Tasks 1-2 completed in prior session)
- **Started:** 2026-05-19T11:07:00Z
- **Completed:** 2026-05-19T11:08:02Z
- **Tasks:** 3 (Tasks 1+2 in prior session; Task 3 in this session)
- **Files modified:** 2 (ci.yml, changeset/config.json — Tasks 1-2); 0 files in Task 3 (pure API operation)

## Accomplishments

- CI workflow committed to develop, pushed, and confirmed green on both Node 22 and Node 24 (run 26093169881)
- Changesets configured with baseBranch:main, access:public, and @changesets/changelog-github — release pipeline ready for Phase 3
- main branch ruleset "require-ci-on-main" active: requires ci(22) + ci(24) to pass before merge; non_fast_forward rule blocks force-push (ASVS V4 / T-03-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: CI workflow + changesets config committed and CI triggered** - `21f5ac7` (ci)
2. **Task 1 auto-fix: removed redundant version field from pnpm/action-setup** - `21f5ac7` (included)
3. **Task 1 auto-fix: downgrade lefthook 2.1.7 → 2.1.6** - `95b5fe9` (fix)
4. **Task 2: checkpoint — human verified CI green** (no commit; API-only verification)
5. **Task 3: main branch ruleset via gh api** (no file commit — pure GitHub API operation)

**Plan metadata:** (this commit — docs: complete 01-03 plan)

## Files Created/Modified

- `.github/workflows/ci.yml` — Node 22+24 matrix CI: biome check, tsc --noEmit, tsdown build, vitest
- `.changeset/config.json` — baseBranch:main, access:public, changelog-github for godoo-dev/godoo-ts

## Decisions Made

- **gh api input format:** `--field` silently stringifies JSON objects/arrays in PowerShell, causing 422 from GitHub API. Fixed by piping full JSON body via `--input -` with `echo '...' |`. Documented as a pattern for future API calls.
- **lefthook 2.1.6:** pnpm 11 `minimumReleaseAge` supply-chain policy rejected lefthook 2.1.7 (published same day as install attempt). Pinned to 2.1.6 — functionally identical.
- **pnpm/action-setup@v6 version field:** The `version: 11` field in the action was redundant — v6 already pins pnpm 11. Removed to avoid version drift confusion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed redundant `version: 11` from pnpm/action-setup@v6**
- **Found during:** Task 1 (CI run monitoring)
- **Issue:** Redundant `version:` field in pnpm/action-setup@v6 could cause drift if v6 is ever re-pinned to a different pnpm major
- **Fix:** Removed the `version: 11` field; v6 of the action pins pnpm 11 implicitly
- **Files modified:** .github/workflows/ci.yml
- **Committed in:** 21f5ac7

**2. [Rule 3 - Blocking] Downgraded lefthook 2.1.7 → 2.1.6**
- **Found during:** Task 1 (CI install step failure)
- **Issue:** pnpm 11 `minimumReleaseAge` supply-chain policy rejects packages published within the last 72 hours; lefthook 2.1.7 was published the same day as the CI run
- **Fix:** Pinned lefthook to 2.1.6 in package.json; committed lockfile together per lockfile-discipline rule
- **Files modified:** package.json, pnpm-lock.yaml
- **Committed in:** 95b5fe9

**3. [Rule 3 - Blocking] Task 3 used `--input -` instead of `--field` for gh api JSON**
- **Found during:** Task 3 (branch ruleset creation)
- **Issue:** `gh api --field` serializes values as strings even when the value is a JSON object/array literal; GitHub's REST API rejected with 422 "not of type object/array"
- **Fix:** Piped the complete JSON body via `echo '...' | gh api ... --input -`
- **Files modified:** none (command-line fix only)
- **Committed in:** not applicable (no file change)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for CI to pass and ruleset to be created. No scope creep.

## Issues Encountered

- `gh api --field` does not forward JSON objects/arrays; must use `--input -` for complex payloads. This is now documented as a pattern in the SUMMARY frontmatter.

## User Setup Required

None — no external service configuration required. The branch ruleset is active and CI is running automatically.

## Next Phase Readiness

- Phase 1 complete: all five success criteria from ROADMAP.md are met
- Phase 2 (package adoption) can begin: CI gating is live, develop branch is the working branch, lockfile is committed and frozen
- Prerequisite: Read `../godoo-hq/.planning/notes/godoo-adoption-protocol.md` before executing Phase 2 (godoo-adoption branch protocol)
- Blocker to note: `@godoo/client` integration tests cannot pass until `@godoo/testcontainers` is adopted (deferred sequencing within Phase 2)

---

*Phase: 01-repo-toolchain-bootstrap*
*Completed: 2026-05-19*

## Self-Check: PASSED

- FOUND: `.planning/phases/01-repo-toolchain-bootstrap/01-03-SUMMARY.md`
- FOUND: commit `21f5ac7` (Task 1 — CI workflow + changeset config)
- FOUND: commit `95b5fe9` (Task 1 auto-fix — lefthook downgrade)
- VERIFIED: `gh api repos/godoo-dev/godoo-ts/rulesets` returns `require-ci-on-main` (enforcement: active, rules: required_status_checks + non_fast_forward)
