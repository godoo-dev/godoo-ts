# Phase 2: Core-3 Adoption & Rename - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 2-core-3-adoption-rename
**Areas discussed:** Git history transfer, Jest → vitest conversion scope, Strict-TS conformance, Integration-test CI job (CORE-03)

---

## Git history transfer

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh copy + baseline tag | Tag `odoo-toolbox` at `pre-adoption-baseline`, plain-copy each package into `godoo-ts/packages/`. Commit references the source SHA. Loses per-file blame in godoo-ts; archaeology lives in the tagged source. Cleanest history, smallest cognitive load. | ✓ |
| `git filter-repo` per package | Extract each package's history with paths rewritten, then merge into godoo-ts as separate branches. Preserves blame in godoo-ts. Larger setup cost; produces synthetic merge commits; needs filter-repo installed. | |
| `git subtree split` | Built-in alternative to filter-repo. Known to produce messy history when source has unrelated churn. | |

**User's choice:** Fresh copy + baseline tag
**Notes:** Aligns with the `godoo-adoption-protocol.md` source-side step 1 (which already calls for the baseline tag). Phase 3 retires `odoo-toolbox` to a deprecation README pointing here, so blame archaeology has a known artifact.

---

## Jest → vitest conversion scope

| Option | Description | Selected |
|--------|-------------|----------|
| One-pass with the rename | Conversion is part of each package's adoption commit. Removes ts-jest / @types/jest / jest config, rewrites `jest.mock` → `vi.mock`, etc. Larger per-adoption diff but no temporary dual-runner state. | ✓ |
| Adopt-then-convert (two plans per package) | Plan A adopts code with jest still working (jest as workspace devDep temporarily). Plan B converts to vitest and removes jest. Smaller commits; brief dual-runner window. | |
| Lift as jest, convert in Phase 2.x | Adopt as jest now, file a Phase 2.x cleanup. Conflicts with the project's "modernize in one pass" stance. | |

**User's choice:** One-pass with the rename
**Notes:** `odoo-testcontainers` already uses vitest — only `odoo-client` and `odoo-introspection` need conversion. Consistent with the Phase-1 toolchain-modernization-in-one-pass posture.

---

## Strict-TS conformance

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in-flight per adoption | Each adoption plan ends with the package strict-clean: explicit return types on all exports, all `any` replaced, no `biome-ignore` suppressions remaining. Biggest per-package diff; no carried debt. | ✓ |
| Adopt with suppressions, dedicated cleanup plan | Initial adoption commit may carry `biome-ignore` and per-file `// @ts-nocheck`. Follow-up plan within Phase 2 removes them before phase verification. Creates a known-debt window. | |
| Relax repo defaults per adopted package | Per-package tsconfig + biome `overrides` so existing code passes as-is. Cleanup deferred. Contradicts Phase 1's hard constraint and PROJECT.md. | |

**User's choice:** Fix in-flight per adoption
**Notes:** The Phase-1 D-03 anticipated Biome reformat pass is folded into this — same files, same edit.

---

## Integration-test CI job (CORE-03) — trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Per-push to develop + main, PRs targeting either | Same triggers as the existing CI job. Catches regressions immediately. ~2-5min cold container start. Free CI minutes on public repo. | ✓ |
| Per-push only when client/testcontainers files change (path filter) | Skips slow job when only docs change. Small risk that cross-package changes get missed. | |
| Nightly cron + manual workflow_dispatch | Decouples integration from PR feedback loop. Day-late bug detection. | |

**User's choice:** Per-push to develop + main, PRs targeting either

---

## Integration-test CI job (CORE-03) — container setup

| Option | Description | Selected |
|--------|-------------|----------|
| Drive entirely via @godoo/testcontainers | Integration tests already import the testcontainers package — let it manage container lifecycle from inside the test process. No services: block, no docker-compose. Single source of truth: the package being tested. | ✓ |
| Reuse odoo-toolbox's docker-compose.test.yml | Lift compose file, start containers via `docker compose up -d` before vitest. Matches source repo's pattern but means testcontainers isn't fully exercised in its own CI. | |
| GitHub Actions services: block | Fastest startup, no Docker socket needed. Odoo's first-run DB init is tricky to express as a service. | |

**User's choice:** Drive entirely via @godoo/testcontainers
**Notes:** Branch protection on `main` (Phase-1 D-09) will need the new integration job names added to the required-status-checks list — flagged in CONTEXT.md `<code_context>` Integration Points.

---

## Claude's Discretion

- Biome reformat pass on adopted code — folded into the in-flight strict-TS pass (D-03).
- `debug` dependency handling — per-package; revisit only if pnpm dedup fails.
- Cross-package workspace dependency style — `workspace:*` for `@godoo/testcontainers` → `@godoo/client` and `@godoo/introspection` → `@godoo/client`.
- CHANGELOG / version baseline for renamed packages — bound to publish, decided in Phase 3.
- `godoo-adoption` branch on `odoo-toolbox` — only the baseline tag is created in Phase 2; branch creation and source-side commits are Phase 3.
- Per-package package.json metadata refresh (author, repository.url, repository.directory, homepage) — bundle with each rename commit.
- Internal vitest config layout (per-package vs root-only) — planner's call.

## Deferred Ideas

- Publishing `@godoo/*` to public npm scope — Phase 3 (PUB-01..02).
- Source-side removal of adopted packages from `odoo-toolbox` — Phase 3 (SHED-01..05).
- CHANGELOG / version baseline — Phase 3, bound to the publish event.
- Workspace catalog or root-hoist for `debug` — only if dedup fails.
- Per-package CommonJS build override — Phase 3, only if a consumer needs it.
- Atlas-MCP salvage from `odoo-mcp` — explicitly an Atlas-MCP-charter decision (PROJECT.md).
