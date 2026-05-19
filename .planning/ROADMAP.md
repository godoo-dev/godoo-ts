# Roadmap: godoo-ts

## Overview

godoo-ts is a code-transfer adoption, not a greenfield build. The journey runs in a
near-linear sequence dictated by hard dependency and test-coupling constraints: first
stand up a clean pnpm-workspace monorepo and its toolchain, then adopt and rename the
three core Odoo libraries from `odoo-toolbox` under the `@godoo/` scope (client leads,
because every other package imports it), then publish the renamed core-3 to the public
`@godoo/` npm scope and shed every non-core package from the source repo until
`odoo-toolbox` is retired. The milestone closes with a single terminal report-back to
the `godoo-hq` spine once all six adoption outcomes are verified.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Repo & Toolchain Bootstrap** - Public monorepo, pnpm/tsdown/vitest/changesets/CI, umbrella-aware CLAUDE.md (completed 2026-05-19)
- [ ] **Phase 2: Core-3 Adoption & Rename** - Adopt and rename client, testcontainers, introspection under `@godoo/`
- [ ] **Phase 3: Publishing & Source-Repo Shedding** - Publish core-3 to npm, shed non-core packages, retire `odoo-toolbox`
- [ ] **Phase 4: Terminal Report-Back** - File the single adoption report to the `godoo-hq` spine

## Phase Details

### Phase 1: Repo & Toolchain Bootstrap

**Goal**: A public `godoo-ts` monorepo exists with a green build/test/release toolchain and is wired into the godoo umbrella, ready to receive adopted packages.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: BOOT-01, BOOT-02, BOOT-03, BOOT-04
**Success Criteria** (what must be TRUE):

  1. The `godoo-dev/godoo-ts` repository exists on GitHub and the local repo pushes to it
  2. A pnpm-workspace monorepo scaffold is in place — workspace manifest, root tsconfig, shared lint/format config
  3. `pnpm install`, a tsdown build, and `vitest` all run green locally, and GitHub Actions CI passes on push
  4. `changesets` is configured and a release pipeline is wired
  5. A fresh clone of `godoo-ts` picks up umbrella context because `CLAUDE.md` `@`-imports `../godoo-hq/UMBRELLA_CLAUDE.md`

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Create GitHub repo, wire remote, and commit root monorepo scaffold (BOOT-01, BOOT-02, BOOT-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Create packages/_example throwaway proof package; green tsdown build + vitest (BOOT-02, BOOT-03 partial)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Commit CI workflow, push to trigger first run, wire changesets, apply main branch ruleset (BOOT-03)

### Phase 2: Core-3 Adoption & Rename

**Goal**: The three core Odoo libraries are adopted from `odoo-toolbox`, renamed under the `@godoo/` scope, and fully validated — including the client's integration tests against real Odoo containers.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05
**Success Criteria** (what must be TRUE):

  1. `@godoo/client` is adopted and renamed from `@marcfargas/odoo-client`, with unit tests passing (integration tests temporarily skipped)
  2. `@godoo/testcontainers` is adopted and renamed from `@marcfargas/odoo-testcontainers`, with its tests passing
  3. The previously-deferred `@godoo/client` integration tests are re-enabled and pass against the adopted `@godoo/testcontainers` and real Odoo containers
  4. `@godoo/introspection` is adopted and renamed from `@marcfargas/odoo-introspection`, with its tests passing
  5. No `@marcfargas/odoo-*` import paths remain — all cross-package imports resolve to the `@godoo/*` scope

**Plans**: TBD

### Phase 3: Publishing & Source-Repo Shedding

**Goal**: The renamed core-3 are live on the public `@godoo/` npm scope, every non-core package is ejected or deprecated, and `odoo-toolbox` is retired with a deprecation README on `main`.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PUB-01, PUB-02, SHED-01, SHED-02, SHED-03, SHED-04, SHED-05
**Success Criteria** (what must be TRUE):

  1. The public `@godoo/` npm scope is configured and ready to receive publishes
  2. `@godoo/client`, `@godoo/introspection`, and `@godoo/testcontainers` are published to the `@godoo/` npm scope and installable
  3. `odoo-skills` is confirmed ejected, and `odoo-cli`, `odoo-mcp`, and `odoo-state-manager` are deprecated per the godoo-adoption protocol (`odoo-mcp` code left in place; `odoo-state-manager` deprecated cleanly in favour of `godoo-stateman`)
  4. `odoo-toolbox` is retired — a deprecation `README.md` pointing to the new package homes is merged to `main`

**Plans**: TBD

### Phase 4: Terminal Report-Back

**Goal**: The adoption is formally closed by recording the verified outcomes in the initiative spine.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: RPT-01
**Success Criteria** (what must be TRUE):

  1. All six adoption outcomes are verified as complete (core-3 published, `odoo-skills` ejected, `odoo-cli`/`odoo-mcp`/`odoo-state-manager` deprecated, `odoo-toolbox` retired)
  2. A single terminal report-back entry is appended (newest-first) to `godoo-hq/dev-log.md`, naming the satellite, completion date, and verified outcomes

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Repo & Toolchain Bootstrap | 3/3 | Complete    | 2026-05-19 |
| 2. Core-3 Adoption & Rename | 0/TBD | Not started | - |
| 3. Publishing & Source-Repo Shedding | 0/TBD | Not started | - |
| 4. Terminal Report-Back | 0/TBD | Not started | - |
