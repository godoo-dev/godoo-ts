---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-21T08:45:00.000Z"
last_activity: 2026-05-21 -- Phase 02-02 complete; @godoo/testcontainers adopted on develop@c9a2225
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 7
  completed_plans: 6
  percent: 32
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-18)

**Core value:** The core-3 libraries are cleanly adopted from `odoo-toolbox`, renamed under `@godoo/`, and published to a single canonical TS home — with no period of dual-maintenance.
**Current focus:** Phase 2 — core 3 adoption & rename

## Current Position

Phase: 2
Plan: 02-02 complete — Wave 3 (02-03 client integration reactivation) next
Status: Executing
Last activity: 2026-05-21 -- Phase 02-02 complete; @godoo/testcontainers adopted on develop@c9a2225

Progress: [█████████░] 86% (6/7 plans complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 2 (of 4) | ~135 min | ~67 min |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-repo-toolchain-bootstrap P01 | 5 | 2 tasks | 19 files |
| Phase 02-core-3-adoption-rename P01 | 75 | 4 tasks | 75 files |
| Phase 02-core-3-adoption-rename P02 | 60 | 4 tasks | 29 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Public GitHub repo under `godoo-dev`, LGPL-3.0 — core-3 are FOSS libraries on the public `@godoo/` npm scope
- Modernize toolchain — pnpm workspaces + tsdown builds, replacing the inherited npm-workspaces/tsc setup in one pass
- Client-first adoption with deferred integration tests — `@godoo/client` integration tests skipped until `@godoo/testcontainers` lands, then re-enabled
- [Phase ?]: Biome 2.4.15 schema: organizeImports moved to assist.actions.source; files.ignore renamed to files.includes with negation; VCS integration enabled
- [Phase ?]: tsdown 0.22.0 ESM output uses .mjs/.d.mts extensions — exports map must reference these, not .js/.d.ts
- [Phase ?]: pnpm 11 requires allowBuilds approval in pnpm-workspace.yaml for packages with postinstall scripts (e.g. lefthook)
- [Phase 02-02]: Cross-package workspace deps use `workspace:*` in BOTH dependencies and peerDependencies; changesets resolves peer to concrete range at Phase-3 publish
- [Phase 02-02]: rolldown-plugin-dts isolatedDeclarations is stricter than `tsc --noEmit` — object-literal lambdas need an explicit interface binding (OdooPresetsApi pattern)
- [Phase 02-02]: cpu-features/protobufjs/ssh2 allowBuilds set to false (transitive deps of dockerode/testcontainers; JS-only fallback sufficient for unit tests; Phase 02-03 may revisit for real Docker integration)

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Adoption runs under the `godoo-adoption` branch protocol (`../godoo-hq/.planning/notes/godoo-adoption-protocol.md`) — read before executing Phase 2/3 code transfer
- `@godoo/client` ↔ `@godoo/testcontainers` test coupling: client integration tests cannot pass until testcontainers is adopted (resolved by deferred-integration-tests sequencing within Phase 2)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-21T08:45:00.000Z
Stopped at: Completed Phase 02-02-PLAN.md; Wave 2 (testcontainers) adopted
Resume file: .planning/phases/02-core-3-adoption-rename/02-03-PLAN.md
