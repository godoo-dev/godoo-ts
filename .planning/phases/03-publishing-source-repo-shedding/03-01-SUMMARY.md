---
phase: 03-publishing-source-repo-shedding
plan: 01
subsystem: infra
tags: [npm, publishing, oidc, trusted-publishing, changesets, scope-rename]

requires:
  - phase: 02-core-3-adoption-rename
    provides: green, publish-ready core-3 packages renamed under the @godoo scope
provides:
  - "@godoo-dev/client@0.0.0, @godoo-dev/introspection@0.0.0, @godoo-dev/testcontainers@0.0.0 published to npm (throw-on-require stubs)"
  - "@godoo-dev npm scope claimed and ready for trusted-publisher configuration (Plan 03-02)"
  - "real packages renamed @godoo/* -> @godoo-dev/* across the monorepo"
affects: [03-02, 03-03, 03-04, 03-05, 03-06]

tech-stack:
  added: []
  patterns:
    - "ephemeral release/stub-bootstrap branch holds throwaway stub packages, kept out of the pnpm workspace under _stubs/"

key-files:
  created:
    - _stubs/@godoo-client-stub/package.json
    - _stubs/@godoo-client-stub/index.js
    - _stubs/@godoo-introspection-stub/package.json
    - _stubs/@godoo-introspection-stub/index.js
    - _stubs/@godoo-testcontainers-stub/package.json
    - _stubs/@godoo-testcontainers-stub/index.js
  modified:
    - packages/client/package.json
    - packages/introspection/package.json
    - packages/testcontainers/package.json
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Scope changed @godoo -> @godoo-dev: the @godoo npm org is not free; packages publish under @godoo-dev. Versions unchanged (0.6.0 / 0.2.1 / 0.1.5)."
  - "D-03 break-glass NPM_TOKEN_BREAKGLASS DROPPED: maintainer disallows npm tokens; release auth is GitHub OIDC trusted-publishing only. No repo secret created."

patterns-established:
  - "Stub packages live under _stubs/ at repo root, outside the pnpm-workspace 'packages/*' glob, so changesets never discovers them"

requirements-completed: [PUB-01]

duration: ~25min
completed: 2026-05-26
---

# Phase 3 / Plan 01: Stub Bootstrap Summary

**Three throw-on-require 0.0.0 stubs published to npm under the new `@godoo-dev` scope, claiming `@godoo-dev/{client,introspection,testcontainers}` ahead of trusted-publisher setup; real packages renamed `@godoo/*` -> `@godoo-dev/*` monorepo-wide.**

## Performance

- **Tasks:** 2 (Task 1 autonomous; Task 2 human-action, performed by maintainer)
- **Files modified:** stub files + 3 package renames + root package.json + lockfile
- **Completed:** 2026-05-26

## Accomplishments
- Created six stub files (3 packages × package.json + throw-on-require index.js) on the ephemeral `release/stub-bootstrap` branch.
- Maintainer published all three stubs to npm via 2FA OTP under `@godoo-dev/*@0.0.0` (confirmed live on npmjs.com).
- Renamed the three real packages and all functional imports/deps from `@godoo/*` to `@godoo-dev/*` (commit `2875014`); build, typecheck, and 262 unit tests pass.

## Task Commits

1. **Task 1: Create stub packages** — `11e9ff0` (chore) on `release/stub-bootstrap`
2. **Stub scope rename to @godoo-dev** — committed on `release/stub-bootstrap`
3. **Real package scope rename @godoo -> @godoo-dev** — `2875014` (refactor) on `develop`

## Decisions Made
- **Scope @godoo -> @godoo-dev** (mid-execution deviation): the `@godoo` org is not free on npmjs. All three packages publish under `@godoo-dev/`; versions unchanged.
- **D-03 break-glass token DROPPED**: maintainer requires OIDC trusted-publishing only; no `NPM_TOKEN_BREAKGLASS` secret was created. CONTEXT.md D-03 marked SUPERSEDED; release.yml (Plan 03-03) is pure-OIDC.

## Deviations from Plan

### Deviation 1 — npm scope @godoo -> @godoo-dev
- **Found during:** Task 2 (publish) — maintainer discovered the `@godoo` org is not free.
- **Fix:** Renamed stubs and real packages to `@godoo-dev/*`; updated CONTEXT.md (D-01/D-02/D-04), Plans 03-02..03-06, PATTERNS.md, RESEARCH.md to the new scope.
- **Verification:** `@godoo-dev/*` live on npmjs.com; repo build/typecheck/tests green.

### Deviation 2 — D-03 break-glass token dropped
- **Found during:** Task 2 — maintainer disallows npm tokens.
- **Fix:** Removed the break-glass secret step from this plan; stripped `NPM_TOKEN_BREAKGLASS` from release.yml plan (03-03); marked D-03 SUPERSEDED in CONTEXT.md.
- **Verification:** No live `NPM_TOKEN_BREAKGLASS` reference remains in any plan or release-workflow spec.

---

**Total deviations:** 2 (both maintainer-decided scope/policy changes, not auto-fixes). **Impact:** publish identity and auth posture changed; no scope creep — same three packages, same versions.

## Issues Encountered
- `npm view @godoo-dev/*` returned E404 from the maintainer's shell shortly after publish (registry read-replica propagation lag); the npmjs.com web view confirmed the packages are live.

## User Setup Required
None for this plan beyond the OTP publish already performed. Plan 03-02 requires the maintainer to configure OIDC trusted publishers on npmjs.com.

## Next Phase Readiness
- `@godoo-dev` scope claimed; three stubs live at `0.0.0` — ready for trusted-publisher configuration (Plan 03-02).
- `release/stub-bootstrap` branch is local-only (not pushed); slated for cleanup in Plan 03-02.
- `develop` and `main` unchanged by the stub work; the scope rename landed on `develop` (`2875014`).

---
*Phase: 03-publishing-source-repo-shedding*
*Completed: 2026-05-26*
