# Requirements: godoo-ts

**Defined:** 2026-05-18
**Core Value:** The core-3 libraries are cleanly adopted from `odoo-toolbox`, renamed under `@godoo/`, and published to a single canonical TS home — with no period of dual-maintenance.

## v1 Requirements

Requirements for the godoo-ts adoption milestone. Each maps to a roadmap phase.

### Repo & Toolchain Bootstrap

- [x] **BOOT-01**: Public `godoo-ts` repository created under the `godoo-dev` GitHub org, with the local repo wired to its remote
- [x] **BOOT-02**: pnpm-workspace monorepo scaffold in place — workspace manifest, root `tsconfig`, shared lint/format config
- [x] **BOOT-03**: Build, test, and release pipelines configured and green — tsdown builds, vitest (unit/integration/packaging), changesets, GitHub Actions CI
- [x] **BOOT-04**: `CLAUDE.md` `@`-imports `../godoo-hq/UMBRELLA_CLAUDE.md` so a fresh clone is umbrella-aware

### Core-3 Adoption & Rename

- [ ] **CORE-01**: `@godoo/client` adopted from `odoo-toolbox` and renamed from `@marcfargas/odoo-client`, with unit tests passing (integration tests temporarily skipped)
- [x] **CORE-02**: `@godoo/testcontainers` adopted from `odoo-toolbox` and renamed from `@marcfargas/odoo-testcontainers`, with its tests passing
- [x] **CORE-03**: `@godoo/client` integration tests re-enabled against the adopted `@godoo/testcontainers` and passing against real Odoo containers
- [ ] **CORE-04**: `@godoo/introspection` adopted from `odoo-toolbox` and renamed from `@marcfargas/odoo-introspection`, with its tests passing
- [ ] **CORE-05**: All cross-package import paths updated from the `@marcfargas/odoo-*` scope to `@godoo/*`

### Publishing

- [ ] **PUB-01**: The public `@godoo/` npm scope is configured and ready to receive package publishes
- [ ] **PUB-02**: `@godoo/client`, `@godoo/introspection`, and `@godoo/testcontainers` published to the public `@godoo/` npm scope

### Source-Repo Shedding

- [ ] **SHED-01**: `odoo-skills` confirmed ejected — not carried into `godoo-ts`
- [ ] **SHED-02**: `odoo-cli` deprecated
- [ ] **SHED-03**: `odoo-mcp` deprecated — code left in place for a future Atlas MCP charter to salvage
- [ ] **SHED-04**: `odoo-state-manager` deprecated cleanly in favour of `godoo-stateman`
- [ ] **SHED-05**: `odoo-toolbox` retired — deprecation `README.md` merged to `main`, pointing to the new package homes

### Report-Back

- [ ] **RPT-01**: Terminal report-back entry appended to `godoo-hq/dev-log.md` once all six adoption outcomes are verified

## v2 Requirements

(None — this milestone is a bounded adoption. Future per-package library work is tracked separately, after each package has its canonical home in godoo-ts.)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `odoo-skills` as a godoo-ts package | CI-generated skill files; belongs in the Atlas KB, not a core library |
| `odoo-cli` | No consumers; domain too large for this satellite |
| `odoo-mcp` as a godoo-ts package | Only salvage-able for a future Atlas MCP build; not adopted as-is |
| `odoo-state-manager` as a godoo-ts package | Superseded by `godoo-stateman`; not a core client library |
| `odoo-test-harness` | Already dead; absorbed into `odoo-testcontainers` |
| Compatibility shim for `odoo-state-manager` | Deprecation is clean; the single internal consumer migrates on its own timeline |
| New features or API changes to the core-3 | This milestone is an adoption + rename, not a feature release |
| What to salvage from `odoo-mcp` | An Atlas MCP charter decision, not godoo-ts's |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOOT-01 | Phase 1 | Complete |
| BOOT-02 | Phase 1 | Complete |
| BOOT-03 | Phase 1 | Complete |
| BOOT-04 | Phase 1 | Complete |
| CORE-01 | Phase 2 | Pending |
| CORE-02 | Phase 2 | Complete |
| CORE-03 | Phase 2 | Complete |
| CORE-04 | Phase 2 | Pending |
| CORE-05 | Phase 2 | Pending |
| PUB-01 | Phase 3 | Pending |
| PUB-02 | Phase 3 | Pending |
| SHED-01 | Phase 3 | Pending |
| SHED-02 | Phase 3 | Pending |
| SHED-03 | Phase 3 | Pending |
| SHED-04 | Phase 3 | Pending |
| SHED-05 | Phase 3 | Pending |
| RPT-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-18*
*Last updated: 2026-05-18 after roadmap creation*
