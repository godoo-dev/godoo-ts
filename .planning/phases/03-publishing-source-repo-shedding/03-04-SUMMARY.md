---
phase: 03-publishing-source-repo-shedding
plan: "04"
subsystem: ci-cd
tags: [npm-publish, oidc, changesets, slsa-provenance, release-workflow, first-publish]
dependency_graph:
  requires: [03-03]
  provides: ["@godoo-dev/client@0.6.1", "@godoo-dev/introspection@0.2.2", "@godoo-dev/testcontainers@0.1.6"]
  affects: [npm-registry, main-branch]
tech_stack:
  added: []
  patterns: [OIDC trusted publishing via changesets/action, GITHUB_TOKEN-pushed branch requires real-user commit to trigger required CI]
key_files:
  created:
    - .planning/phases/03-publishing-source-repo-shedding/03-04-SUMMARY.md
  modified: []
decisions:
  - "D-01 revised by maintainer: first @godoo-dev/* publish lands at inherited+patch (0.6.1 / 0.2.2 / 0.1.6), NOT the bare inherited versions — patch-level rename changesets always bump, Research Assumption A2 was wrong"
  - "Org-level workflow write permission was the publish blocker; fixed via Option A (org settings: Read+write + allow Actions to create/approve PRs)"
  - "Required CI on a github-actions[bot]-pushed branch was triggered by pushing an empty real-user commit — not by bypassing branch protection"
  - "OIDC-only publish confirmed: workflow log shows 'No NPM_TOKEN found, but OIDC is available' — no token used (D-03 stays dropped)"
metrics:
  duration: "~25 minutes (across two resume cycles)"
  completed: "2026-05-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 03 Plan 04: First @godoo-dev/* npm Publish Summary

**One-liner:** First real publish of the three core-3 packages to the public npm registry via the OIDC release workflow — `@godoo-dev/client@0.6.1`, `@godoo-dev/introspection@0.2.2`, `@godoo-dev/testcontainers@0.1.6`, each with SLSA provenance and concrete cross-package version resolution.

## What Was Built

This plan was an operation, not a code change: it drove the develop→main merge, exercised the `changesets/action` release workflow end-to-end, and confirmed all three packages landed on npm.

**Task 1 — develop → main merge (release trigger)**
- Pushed develop (32 commits) to origin.
- Opened PR #1 (`feat(publish): wire release workflow and seed rename changesets`), develop → main.
- All four required CI checks passed (ci 22, ci 24, integration 22, integration 24).
- Merged PR #1 via **merge commit** `50dec9eb` (NOT squash, develop preserved and not deleted).
- The push to main triggered the release workflow, which ran `changeset version` and (on the rerun, see below) opened the "Version Packages" PR.

**Task 2 — Version Packages PR merge + publish verification**
- The "Version Packages" PR (#2) was created by `changesets/action`, bumping all three packages by one patch and writing CHANGELOG.md entries.
- Merged PR #2 via squash (`fd74fbf`), triggering the publish run.
- Publish run `26475727726` concluded **success** in 42s. Log confirmed OIDC trusted publishing (no token).
- All three packages verified live on npm with concrete dependency resolution and SLSA provenance.

## Verification Results

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Publish run conclusion | success | success (run 26475727726, 42s) | PASS |
| `npm view @godoo-dev/client version` | 0.6.1 | 0.6.1 | PASS |
| `npm view @godoo-dev/introspection version` | 0.2.2 | 0.2.2 | PASS |
| `npm view @godoo-dev/testcontainers version` | 0.1.6 | 0.1.6 | PASS |
| testcontainers peerDependencies `@godoo-dev/client` | concrete range, not workspace:* | `0.6.1` | PASS (T-03-14) |
| testcontainers dependencies `@godoo-dev/client` | concrete range, not workspace:* | `0.6.1` | PASS (T-03-14) |
| client SLSA provenance | non-null | `https://slsa.dev/provenance/v1` | PASS (T-03-15) |
| introspection SLSA provenance | non-null | `https://slsa.dev/provenance/v1` | PASS (T-03-15) |
| testcontainers SLSA provenance | non-null | `https://slsa.dev/provenance/v1` | PASS (T-03-15) |
| OIDC used (no token) | OIDC-only | "No NPM_TOKEN found, but OIDC is available - using npm trusted publishing" | PASS (T-03-16) |

**npm propagation lag:** none observed — all three `npm view` queries returned the correct version immediately after the run completed.

**Git tags pushed to origin:** `@godoo-dev/client@0.6.1`, `@godoo-dev/introspection@0.2.2`, `@godoo-dev/testcontainers@0.1.6` (all pointing at merge commit `fd74fbf`).

## Deviations from Plan

### 1. [Blocker → maintainer fix] Org-level workflow write permission blocked the first release run

- **Found during:** First release run (`26475064549`) after PR #1 merged.
- **Issue:** `changesets/action` ran `changeset version` successfully but failed to open the Version Packages PR with `HttpError: GitHub Actions is not permitted to create or approve pull requests`. Root cause was an org-level policy: `default_workflow_permissions: read` and `can_approve_pull_request_reviews: false`, enforced at the `godoo-dev` org level (`PUT .../actions/permissions/workflow` returned `409 Conflict: Write permissions for workflows are disabled by the organization`). Could not be fixed at the repo level or with the available token scope.
- **Fix (maintainer, Option A):** Org settings changed to "Read and write permissions" + "Allow GitHub Actions to create and approve pull requests". The failed run was then re-run (`gh run rerun 26475064549`) and succeeded, creating PR #2.

### 2. [D-01 revision] First publish landed at inherited+patch, not bare inherited versions

- **Found during:** Reviewing the Version Packages PR #2 diff.
- **Issue:** The three `patch`-level rename changesets (authored in Plan 03-03) caused `changeset version` to bump each package by one patch: client 0.6.0→0.6.1, introspection 0.2.1→0.2.2, testcontainers 0.1.5→0.1.6. This contradicted CONTEXT.md D-01 ("carry inherited versions unchanged"). Research Assumption A2 / Pitfall 2 was **incorrect** — it assumed a `patch` changeset would be a no-op when package.json already held the target version; in reality `changeset version` always applies the bump.
- **Resolution:** STOPPED and reported to the maintainer per the plan's "if versions are wrong, STOP" instruction, before merging anything. State was fully reversible at that point (only `0.0.0` stubs on the registry, package.json on main still at inherited versions, PR #2 unmerged). The maintainer **accepted the patch bump** and revised D-01 to the new baseline 0.6.1 / 0.2.2 / 0.1.6. (CONTEXT.md D-01 update is owned by the orchestrator, not touched here.)

### 3. [Rule 3 - Blocking issue] github-actions[bot]-pushed branch did not trigger required CI

- **Found during:** Attempting `gh pr merge 2 --squash` — rejected with "base branch policy prohibits the merge".
- **Issue:** The `require-ci-on-main` ruleset requires four status checks (ci 22/24, integration 22/24). PR #2's `changeset-release/main` branch was pushed by `github-actions[bot]` using `GITHUB_TOKEN`; by GitHub design, workflows do not trigger on `GITHUB_TOKEN`-created events, so the PR had no checks ("no checks reported").
- **Fix:** Pushed a single empty real-user commit (`git commit --allow-empty`, `76a88c6`) to `changeset-release/main`. This fired the `pull_request` CI run (`26475541762`), all four checks passed, and the ruleset was satisfied. This satisfies branch protection by running the required checks — it does **not** bypass it (no `--admin`, no `--no-verify`, no ruleset edit).

## Commits

This plan produced no per-task source commits in the repo (it is a publish operation). The git history artifacts it created:

| Artifact | Ref | Note |
|----------|-----|------|
| PR #1 merge (develop → main) | `50dec9eb` | merge commit; develop preserved |
| CI-trigger empty commit on release branch | `76a88c6` | real-user commit to fire required checks |
| PR #2 squash merge (version packages) | `fd74fbf` | triggered the publish run |
| Publish git tags | client@0.6.1 / introspection@0.2.2 / testcontainers@0.1.6 | pushed by the workflow |

The SUMMARY itself is committed on develop (hash recorded in the final report).

## Threat Register Outcomes

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-03-14 (workspace:* published as-is) | mitigate | RESOLVED — peerDependencies + dependencies both show concrete `@godoo-dev/client: 0.6.1` |
| T-03-15 (missing SLSA provenance) | mitigate | RESOLVED — all three packages carry `slsa.dev/provenance/v1` attestation |
| T-03-16 (break-glass token used as default) | n/a | CONFIRMED n/a — log shows OIDC used, no token present |
| T-03-17 (Version Packages PR not created) | mitigate | RESOLVED — PR #2 created after org-policy fix |

## Self-Check: PASSED

- `.planning/phases/03-publishing-source-repo-shedding/03-04-SUMMARY.md` exists: FOUND
- Publish run `26475727726` conclusion: success (verified via `gh run view`)
- `@godoo-dev/client@0.6.1` live on npm: FOUND
- `@godoo-dev/introspection@0.2.2` live on npm: FOUND
- `@godoo-dev/testcontainers@0.1.6` live on npm: FOUND
- testcontainers peerDependencies resolved to concrete `0.6.1`: CONFIRMED
- SLSA provenance on all three packages: CONFIRMED
- Current branch is develop (not main): CONFIRMED
- ROADMAP.md / STATE.md not modified by this plan: CONFIRMED
