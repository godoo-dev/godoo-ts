# Phase 3: Publishing & Source-Repo Shedding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 03-publishing-source-repo-shedding
**Areas discussed:** First-publish version baseline, Publish auth + release flow, @marcfargas/* deprecation mechanics, Shed sequence + odoo-toolbox retirement form
**Mode:** advisor (research-backed comparison tables; calibration tier `standard`)

---

## First-publish version baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Carry inherited (0.6.0/0.2.1/0.1.5) | No API change → no version reset; preserves real maturity signal; zero downstream-resolution risk since scope rename forces explicit migration | ✓ |
| Reset all to 0.1.0 | Fresh-scope baseline narrative; trades the maturity signal for clean optics | |
| Jump all to 1.0.0 | Locks stable-API contract on first publish; premature for testcontainers/introspection | |
| Per-package judgement | Client keeps 0.6.0, others reset — inconsistent but maturity-honest | |

**User's choice:** Carry inherited (0.6.0/0.2.1/0.1.5) — the recommended option.
**Notes:** Aligns with semver doctrine (no code change → no version bump) and preserves the real mature/usable/usable spread. Recorded as D-01 in CONTEXT.md.

---

## Publish auth + release flow

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — manual first publish, then changesets/action + OIDC | Sidesteps OIDC bootstrap chicken-and-egg; provenance from v2; granular NPM_TOKEN kept as break-glass for npm/cli#8976 | |
| changesets/action + classic NPM_TOKEN throughout | Battle-tested; no provenance by default; long-lived secret to rotate | |
| Pure OIDC trusted publishing only | FOSS-first, no long-lived secrets, but blocked by bootstrap problem on first publish | |
| Manual pnpm publish from laptop only | Validates org/scope/bin/2FA end-to-end; not repeatable, no provenance | |
| Stub-bootstrap + OIDC for both first and ongoing releases (user-refined "Other") | Publish minimal 0.0.0 stubs manually to claim names, configure trusted publishers against existing packages, then let CI/CD do the real first publish at D-01 versions with provenance | ✓ |

**User's choice (free-text refinement):** "We publish stubs manually to setup trusted publishing, then release from cicd" — a cleaner variant of the hybrid (d) option that bootstraps OIDC for the first real publish too, not just for ongoing releases.
**Notes:** Recorded as D-02 + D-03 in CONTEXT.md. D-02 captures the stub-bootstrap + OIDC flow; D-03 captures the granular `@godoo/*` NPM_TOKEN kept in repo secrets as documented break-glass for the active `npm/cli#8976` scoped-OIDC bug.

### Follow-up sub-question — Stub-publish details

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal 0.0.0 stub: package.json + README; main throws "placeholder" | Three publishes at @godoo/{client,introspection,testcontainers}@0.0.0; throwing main means no one accidentally consumes the stub | ✓ |
| Minimal 0.0.0 stub but main is harmless empty export | Quieter, less defensive | |
| Real 0.6.0/0.2.1/0.1.5 from laptop, OIDC only for subsequent releases | Skips the stub-then-real two-step but means the first real publish has no provenance attestation | |

**User's choice:** Throwing-main 0.0.0 stub. Recorded in CONTEXT.md D-02 and `<specifics>`.

---

## @marcfargas/* deprecation mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| npm deprecate only (no final release), per-package messages | Ecosystem norm for renames; zero release noise on a repo whose code is leaving; reversible; install-time surface on npm/pnpm/yarn | ✓ |
| Final release with deprecation banner + npm deprecate | Runtime nag for stale-lockfile users; 7 publishes + OTP on code that's leaving — exactly the dual-maintenance noise the protocol forbids | |
| Final release with throwing stub + npm deprecate | Impossible to ignore but breaks the internal BGBL consumer; contradicts "no shim, on its own timeline" | |
| Deprecate only the three replaced packages; leave cli/mcp/state-manager untouched | Leaves four packages unmarked; minor work saved but ecosystem-hygiene gap | |

**User's choice:** npm deprecate only, all seven packages. Recorded as D-04 in CONTEXT.md.
**Notes:** Live `npm view` against the registry confirmed `@marcfargas/odoo-skills@0.5.3` is published (CC0-1.0, 10 versions, OIDC-published), so it is included in the wind-down — total of seven `npm deprecate` commands.

### Follow-up sub-question — Deprecation message for @marcfargas/odoo-skills

| Option | Description | Selected |
|--------|-------------|----------|
| "Deprecated. CI-generated knowledge modules — future home TBD in the Atlas KB" | Honest "no direct replacement on @godoo"; skills are knowledge files, not a library | ✓ |
| "Deprecated. See godoo-dev for the godoo initiative." | Generic pointer, no commitment to a future home | |
| "Deprecated. No replacement." | Bluntest — doesn't mention any future Atlas KB | |

**User's choice:** Atlas-KB-pointer message. Locked into D-04's per-package message table.

---

## Shed sequence + odoo-toolbox retirement form

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — PR1 sheds core trio, PR2 winds down non-core + writes deprecation README; rename master→main; GitHub-archive | Mirrors adoption history (core was one coupled unit); separates shed-because-adopted from shed-because-deprecated cleanly | ✓ |
| Single shed PR — one branch, commit-per-package + README; rename + archive | One atomic retirement moment; one git-log entry instead of two | |
| Per-package shed PRs paired with npm deprecate | Faithful to protocol wording but pure theatre once adoption is complete | |
| Ship-of-Theseus — forked archive repos per package | Per-package archeology URLs; redundant given pre-adoption-baseline tag + GitHub archive | |

**User's choice:** Hybrid two-PR shed + rename + archive. Recorded as D-05 + D-06 in CONTEXT.md.

### Follow-up sub-question — odoo-mcp "code left in place" interpretation

| Option | Description | Selected |
|--------|-------------|----------|
| targets/odoo-mcp/ stays in the archived odoo-toolbox; deprecation README points at it as the salvage source | Archive freezes the repo — mcp code is accessible at its archived path and at pre-adoption-baseline; retirement README links there explicitly | ✓ |
| targets/odoo-mcp/ moved to a new odoo-mcp-salvage repo before archiving | Salvage code gets its own repo (read-only); odoo-toolbox is then fully empty | |
| targets/odoo-mcp/ deleted; available via git history at pre-adoption-baseline tag only | No live tree | |

**User's choice:** Preserve `targets/odoo-mcp/` in the archived tree; retirement README links to it. Locked into D-06.

---

## Claude's Discretion

The following are left to the planner / executor per CONTEXT.md `<decisions>` "Claude's Discretion" subsection:

- Stub package.json shape (exact form of throwing main, presence of `private: false`, etc.) — constraints are fixed (name, version 0.0.0, `publishConfig.access: public`, LGPL-3.0, repository pointing at godoo-dev/godoo-ts, runnable throwing main).
- Whether the stub publishes land on a short-lived `release/stub-bootstrap` branch (recommended) or another scaffold style.
- Release-workflow concrete choice — `changesets/action` is recommended; planner may switch to a manual `pnpm changeset version` + `pnpm -r publish --provenance` if upstream issues bite.
- GitHub environment for the release workflow (dedicated `production` environment vs direct).
- Deprecation-script form (committed helper vs ad-hoc commands).
- Whether to remove the existing `marcfargas/odoo-toolbox` trusted publishers before archiving vs let the archive freeze them.
- Within-phase ordering of (6) deprecation pass vs (7)–(9) source-side shed/rename/archive — recommended order in CONTEXT.md but reorderable.

## Deferred Ideas

See CONTEXT.md `<deferred>`. Summary:
- Terminal report-back to `godoo-hq/dev-log.md` — Phase 4 (RPT-01).
- Salvaging from `targets/odoo-mcp/` into an Atlas MCP build — Atlas MCP charter.
- Compatibility shim for `@marcfargas/odoo-state-manager` → `godoo-stateman` — out of scope per PROJECT.md.
- CommonJS dual builds for any `@godoo/*` package — revisit when a real CJS consumer surfaces.
- Carrying inherited CHANGELOG.md histories forward into the @godoo/ scope — explicitly choose to seed fresh on the new scope; archived `odoo-toolbox` preserves the originals at `pre-adoption-baseline`.
- GitHub Sponsors / npm-funding redirect on the retired source repo.

No scope creep was raised during discussion — all four selected gray areas and all three follow-ups stayed inside the phase boundary.
