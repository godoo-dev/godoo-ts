---
phase: 03-publishing-source-repo-shedding
plan: 02
subsystem: infra
tags: [npm, oidc, trusted-publishing, github-actions, provenance]

requires:
  - phase: 03-publishing-source-repo-shedding
    provides: "@godoo-dev/* stub packages live on npm (03-01) so trusted publishers have a target to bind to"
provides:
  - "npm OIDC trusted publishers configured for @godoo-dev/client, @godoo-dev/introspection, @godoo-dev/testcontainers, each bound to godoo-dev/godoo-ts + release.yml with the 'npm publish' action allowed"
  - "ephemeral release/stub-bootstrap branch deleted; develop/main carry no stub files"
affects: [03-03, 03-04]

tech-stack:
  added: []
  patterns:
    - "npm trust github --allow-publish (npm >= 11.10) binds publish permission to a repo+workflow OIDC subject; no long-lived token"

key-files:
  created: []
  modified: []

key-decisions:
  - "No GitHub environment gate on the trusted publishers (environment left blank); release.yml will match (no environment)."
  - "npm upgraded 11.12.1 -> 11.15.0 to obtain the --allow-publish flag so the mandatory post-2026-05-20 publish action is set via CLI (no UI step needed)."

patterns-established:
  - "Trusted-publisher binding uses workflow filename release.yml + repo godoo-dev/godoo-ts; forks get a different OIDC subject and cannot publish"

requirements-completed: [PUB-01]

duration: ~human-gated
completed: 2026-05-26
---

# Phase 3 / Plan 02: Trusted Publishers Summary

**Three `@godoo-dev/*` packages bound to GitHub Actions OIDC trusted publishing (repo `godoo-dev/godoo-ts`, workflow `release.yml`, publish allowed); ephemeral stub branch cleaned up.**

## Performance

- **Tasks:** 2 (Task 1 human-action — maintainer configured trusted publishers; Task 2 autonomous — branch cleanup)
- **Completed:** 2026-05-26

## Accomplishments
- Maintainer configured npm OIDC trusted publishers for all three `@godoo-dev/*` packages via `npm trust github … --allow-publish` (after upgrading npm to 11.15.0 for the flag), each bound to `godoo-dev/godoo-ts` + `release.yml`, publish action enabled.
- Deleted the local `release/stub-bootstrap` branch (`was 7af6e7c`); `_stubs/` no longer exists on `develop` or `main`.

## Task Commits
1. **Task 1: Configure trusted publishers** — no repo commit (npmjs.com registry-side config, performed by maintainer with browser 2FA)
2. **Task 2: Delete release/stub-bootstrap branch** — branch deletion (no file commit)

## Decisions Made
- **No environment gate:** trusted publishers configured with environment blank; `release.yml` (Plan 03-03) will define no `environment:` to match the OIDC subject.
- **npm 11.15.0:** upgraded from 11.12.1 because 11.12.1's `npm trust github` lacked `--allow-publish`; 11.15.0 has it, so the publish allowed-action was set via CLI rather than the npmjs.com UI.

## Deviations from Plan
- Plan 03-02 anticipated a possible npmjs.com UI fallback for the allowed action; instead the npm upgrade exposed `--allow-publish`, so the CLI path covered it. The `npm trust github`/`npm trust list` commands require interactive browser 2FA, which only completes from a standalone terminal (not the agent environment or the inline `!` harness) — the maintainer ran them.

## Issues Encountered
- `npm trust` commands return `EOTP` immediately under any non-interactive TTY (agent shell, inline `!`); they only complete in a real interactive terminal where npm holds the browser web-auth session open. Resolved by the maintainer running them directly.

## User Setup Required
None remaining for this plan.

## Next Phase Readiness
- OIDC trust is in place for all three packages → the release workflow can publish without a token.
- `release.yml` does not yet exist — Plan 03-03 creates it (the trusted publisher references this filename in advance, which is supported).
- On `develop`, working tree clean of stub artifacts.

---
*Phase: 03-publishing-source-repo-shedding*
*Completed: 2026-05-26*
