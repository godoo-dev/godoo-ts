---
phase: 03-publishing-source-repo-shedding
plan: "03"
subsystem: ci-cd
tags: [release-workflow, changesets, oidc, npm-publish, github-actions]
dependency_graph:
  requires: [03-02]
  provides: [release.yml, rename-changesets]
  affects: [.github/workflows/, .changeset/]
tech_stack:
  added: [changesets/action@v1]
  patterns: [OIDC trusted publishing, Node 24 + npm v11 OIDC workaround, pnpm-before-node action ordering]
key_files:
  created:
    - .github/workflows/release.yml
    - .changeset/rename-client.md
    - .changeset/rename-introspection.md
    - .changeset/rename-testcontainers.md
  modified:
    - .gitignore
decisions:
  - "OIDC-only: D-03 token fallback dropped 2026-05-26; NODE_AUTH_TOKEN explicitly cleared to prevent setup-node shadowing"
  - "Node 24 hard-pinned (not matrix): npm/cli#8976 workaround — npm v11+ required for OIDC trusted publishing"
  - "Patch-level changesets: inherited versions (0.6.0/0.2.1/0.1.5) already reflect maturity; patch signals rename-only, no API change"
  - ".gitignore .changeset/*.md entry removed: was blocking changeset file tracking (Rule 1 auto-fix)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 03 Plan 03: Release Workflow and Rename Changesets Summary

**One-liner:** OIDC-only GitHub Actions release workflow with changesets/action and three rename changeset files seeding the first @godoo-dev/* publish.

## What Was Built

**Task 1 — .github/workflows/release.yml**

Created the GitHub Actions release workflow that fires on push to `main` only. The workflow uses the `changesets/action@v1` pattern to either create a "Version Packages" PR or publish to npm, depending on whether pending changesets exist. Key security properties:

- `permissions: id-token: write` — required for npm OIDC trusted publishing
- `node-version: 24` — hard-pinned single value, not a matrix; npm/cli#8976 means only npm v11+ (shipped with Node 24) supports OIDC publishing
- `NODE_AUTH_TOKEN: ''` — explicitly cleared in the changesets step env; prevents `setup-node` from injecting a registry token that would shadow OIDC auth
- `NPM_CONFIG_PROVENANCE: 'true'` — enables SLSA provenance attestation on every published package
- `fetch-depth: 0` — required so changesets can detect changed packages via git history
- `pnpm/action-setup@v6` before `actions/setup-node@v4` — load-bearing ordering from ci.yml (pnpm must be on PATH when node's cache step runs)
- No `environment:` key — npm trusted publishers were configured with blank environment in Plan 03-02

**Task 2 — Three rename changeset files**

Created `.changeset/rename-client.md`, `.changeset/rename-introspection.md`, `.changeset/rename-testcontainers.md`. Each uses `patch` level for its package with a rename migration note. `pnpm changeset status` confirms all three packages pending at patch.

## Verification Results

All automated checks passed:

| Check | Result |
|-------|--------|
| `id-token: write` present | 1 occurrence |
| `node-version: 24` present | 1 occurrence |
| `node-version: 22` absent | 0 occurrences |
| `NODE_AUTH_TOKEN: ''` present | 1 occurrence |
| `fetch-depth: 0` present | pass |
| `pnpm/action-setup` present | pass |
| `changesets/action@v1` present | pass |
| `pnpm release` publish script | pass |
| rename-*.md count | 3 |
| `pnpm changeset status` | @godoo-dev/client, @godoo-dev/introspection, @godoo-dev/testcontainers all pending patch |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed .changeset/*.md from .gitignore**

- **Found during:** Task 2 — `git add .changeset/rename-*.md` failed with "paths are ignored by .gitignore"
- **Issue:** `.gitignore` contained `.changeset/*.md`, which prevents changeset files from being tracked. Changesets entirely depends on committing these `.md` files — they are the mechanism by which pending changes are communicated between contributors and the release workflow.
- **Fix:** Removed the `.changeset/*.md` line from `.gitignore`
- **Files modified:** `.gitignore`
- **Commit:** 78af887 (included in the changeset commit)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 — release.yml | ed4550b | `ci(release): add OIDC trusted-publish release workflow with changesets/action` |
| 2 — rename changesets + gitignore fix | 78af887 | `chore(changesets): seed rename changesets for @godoo-dev/* first publish` |

## Next Step (Wave 4)

The develop branch now has both commits ready to PR to main. When the PR is merged, the release workflow will fire, `changesets/action` will find the three pending changesets, and publish `@godoo-dev/client@0.6.0`, `@godoo-dev/introspection@0.2.1`, and `@godoo-dev/testcontainers@0.1.5` to npm with SLSA provenance attestation.

## Self-Check: PASSED

- `.github/workflows/release.yml` exists: FOUND
- `.changeset/rename-client.md` exists: FOUND
- `.changeset/rename-introspection.md` exists: FOUND
- `.changeset/rename-testcontainers.md` exists: FOUND
- Commit ed4550b exists: FOUND (git log)
- Commit 78af887 exists: FOUND (git log)
- Branch is develop (not main): CONFIRMED
- `pnpm changeset status` shows all 3 packages pending: CONFIRMED
