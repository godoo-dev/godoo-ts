---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-26T13:00:26.282Z"
last_activity: 2026-05-26 -- Phase 03 planning complete
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 13
  completed_plans: 7
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-18)

**Core value:** The core-3 libraries are cleanly adopted from `odoo-toolbox`, renamed under `@godoo/`, and published to a single canonical TS home — with no period of dual-maintenance.
**Current focus:** Phase 2 — core 3 adoption & rename

## Current Position

Phase: 02 — COMPLETE
Plan: 02-04 complete — Phase 2 closed; Phase 3 (Publishing & Source-Repo Shedding) next
Status: Ready to execute
Last activity: 2026-05-26 -- Phase 03 planning complete

Progress: [██████████] 100%

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
| Phase 02 P03 | 45 | 6 tasks | 19 files |
| Phase 02 P04 | 45 | - tasks | - files |

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
- [Phase ?]: [Phase 02-03]: vitest 'projects: [packages/*]' overrides root test.exclude per-project — every package with integration tests needs a defensive per-package vitest.config.ts exclude (precedent: testcontainers 02-02; now applied to client 02-03)
- [Phase ?]: [Phase 02-03]: GitHub branch ruleset 'require-ci-on-main' now requires 4 status checks (ci 22, ci 24, integration 22, integration 24) — adding container-backed integration tests to a future package requires adding its CI job name to the ruleset, or merges to main will not gate on it
- [Phase ?]: [Phase 02-03]: vitest globalSetup is the single source of container lifecycle for client integration tests; the 7 process.env.ODOO_* names (ODOO_URL/ODOO_DB_NAME/ODOO_DB_USER/ODOO_DB_PASSWORD plus the 3 examples-only aliases) are injected once and read by every test — no per-test container setup, no docker-compose, no services: block (D-05)
- [Phase ?]: [Phase 02-04]: tsdown 0.22.0 preserves source-file shebangs AND grants execute permission to the emitted .mjs bin file (Assumption A1 confirmed empirically) — no config-side workaround needed for POSIX-executable CLI bins
- [Phase ?]: [Phase 02-04]: Codegen template-string strict-TS pattern — when emitting TypeScript that references Domain (or any cross-package type), prepend an 'import type { Domain } from @godoo/client;' line to the template so generated user code stays standalone-valid
- [Phase ?]: [Phase 02-04]: Two-entry tsdown config established for packages with a bin entry — { entry: ['./src/index.ts', './src/cli/cli.ts'], format: 'esm', dts: true } emits dist/index.mjs + dist/cli/cli.mjs with paired .d.mts; bin entry references the .mjs file (NOT .js — Phase-1 landmine #1)

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

Last session: 2026-05-21T15:14:33.735Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-publishing-source-repo-shedding/03-CONTEXT.md
