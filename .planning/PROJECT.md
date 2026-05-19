# godoo-ts

## What This Is

godoo-ts is the TypeScript library monorepo of the godoo / Odoo Atlas initiative. It
adopts the three core Odoo client libraries from the broader `odoo-toolbox` repo —
renaming them under the `@godoo/` npm scope — and becomes their single canonical home,
published as the TypeScript surface of the Odoo Atlas core-3 library parity scope. It
is for TypeScript developers managing real Odoo ERP instances as code.

## Core Value

The core-3 libraries — `@godoo/client`, `@godoo/introspection`, `@godoo/testcontainers`
— are cleanly adopted from `odoo-toolbox`, renamed under `@godoo/`, and published to a
single canonical TS home, with **no period of dual-maintenance** between the two repos.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] Public `godoo-ts` repo created under the `godoo-dev` org and wired to its remote — Validated in Phase 1: Repo & Toolchain Bootstrap
- [x] pnpm-workspace monorepo scaffold in place — pnpm/tsdown/vitest/changesets/GitHub Actions CI all green — Validated in Phase 1: Repo & Toolchain Bootstrap
- [x] `CLAUDE.md` `@`-imports `../godoo-hq/UMBRELLA_CLAUDE.md` so the repo stays umbrella-aware — Validated in Phase 1: Repo & Toolchain Bootstrap

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

- [ ] `@godoo/client` adopted and renamed from `@marcfargas/odoo-client` (integration tests temporarily deferred)
- [ ] `@godoo/testcontainers` adopted and renamed from `@marcfargas/odoo-testcontainers`; deferred `@godoo/client` integration tests re-enabled and passing
- [ ] `@godoo/introspection` adopted and renamed from `@marcfargas/odoo-introspection`
- [ ] Core-3 published to the public `@godoo/` npm scope
- [ ] `odoo-skills` ejected — not carried into godoo-ts
- [ ] `odoo-cli` deprecated
- [ ] `odoo-mcp` deprecated (code left in place for a future Atlas MCP charter to salvage)
- [ ] `odoo-state-manager` deprecated cleanly in favour of `godoo-stateman`
- [ ] `odoo-toolbox` source repo retired — deprecation `README.md` merged to `main`, pointing to the new package homes
- [ ] Terminal report-back filed to `godoo-hq/dev-log.md` once all six outcomes are met

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- `odoo-skills` package — CI-generated skill files; belongs in the Atlas KB, not a core library
- `odoo-cli` — no consumers; domain too large for this satellite
- `odoo-mcp` as-is — only salvage-able for a future Atlas MCP build; not adopted as a package
- `odoo-state-manager` — superseded by `godoo-stateman`; not a core client library
- `odoo-test-harness` — already dead; absorbed into `odoo-testcontainers`
- New features or API changes to the core-3 — this milestone is an adoption + rename, not a feature release
- Retaining a compatibility shim for `odoo-state-manager` — deprecation is clean; the one internal consumer migrates on its own timeline

## Context

- godoo-ts is a **Layer-1 satellite** of the godoo / Odoo Atlas initiative — its own
  GSD project, its own `.git`, its own release cadence. It sits as a sibling of the
  spine `godoo-hq` under the `godoo-dev` umbrella folder (siblings-never-nested).
- The shared umbrella context lives in `../godoo-hq/UMBRELLA_CLAUDE.md` and is
  `@`-imported (never copied) by this repo's `CLAUDE.md`.
- `SEED.md` (this repo's first commit) is the adoption brief that bootstrapped this
  GSD project; the permanent trace in the spine is the Phase 3 entry in
  `godoo-hq/dev-log.md`.
- **Source repo:** `odoo-toolbox` at `C:\dev\odoo-toolbox` — currently npm workspaces +
  vitest (unit/integration/packaging configs) + eslint/prettier + changesets + GitHub
  Actions + vitepress docs + husky, licensed LGPL-3.0.
- **Core-3 maturity / size (source LOC / test LOC):** `odoo-client` MATURE (5,418 /
  4,807); `odoo-introspection` USABLE (1,360 / 851); `odoo-testcontainers` USABLE
  (1,381 / 549).
- The code transfer runs under the initiative's **`godoo-adoption` branch protocol**
  (`../godoo-hq/.planning/notes/godoo-adoption-protocol.md`): a shared `godoo-adoption`
  branch on both repos, code removed from the source as each package is confirmed
  stable in godoo-ts — so every package lives in exactly one repo at any moment.
- `odoo-state-manager` has one internal consumer; its migration to `godoo-stateman`
  proceeds on that project's own timeline.

## Constraints

- **Tech stack**: TypeScript (strict, no `any`); pnpm workspaces; tsdown builds; vitest test runner — chosen to modernize the inherited npm-workspace/tsc toolchain in one pass during adoption
- **License**: LGPL-3.0 — carried from `odoo-toolbox`; drives the public repo decision
- **Process**: `godoo-adoption` branch protocol — no dual-maintenance; code is removed from `odoo-toolbox` as godoo-ts confirms each package stable
- **Dependency**: the `@godoo/client` rename must lead — every other package imports from it, so renaming any package before the client would force two passes of import-path updates
- **Coupling**: `@godoo/client`'s integration test suite spins up real Odoo containers via `@godoo/testcontainers`; the client cannot be fully validated until `testcontainers` is adopted
- **Reporting**: a single terminal report-back is appended to `godoo-hq/dev-log.md` — only when all six success outcomes are met; no periodic status updates
- **Umbrella wiring**: the generated `CLAUDE.md` must `@`-import `../godoo-hq/UMBRELLA_CLAUDE.md`

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Public GitHub repo, LGPL-3.0 | Core-3 are FOSS libraries published to the public `@godoo/` npm scope; EU/FOSS-first stance | — Pending |
| Modernize toolchain — pnpm workspaces + tsdown builds | Cleaner monorepo than the inherited npm-workspaces/per-package-tsc setup; one-time migration folded into the adoption. tsdown replaces tsup (Phase 1 research: tsup is no longer actively maintained) | — Pending |
| Client-first adoption with deferred integration tests | Avoids renaming the coupled pair simultaneously; client integration tests are skipped until `@godoo/testcontainers` lands, then re-enabled | — Pending |
| Deprecate `odoo-state-manager` cleanly (no shim) | `godoo-stateman` supersedes it; the single internal consumer migrates on its own timeline | — Pending |
| `odoo-mcp` deprecated; salvage deferred | What to salvage into a future Atlas MCP build is that charter's decision, not godoo-ts's | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-19 — Phase 1 (Repo & Toolchain Bootstrap) complete*
