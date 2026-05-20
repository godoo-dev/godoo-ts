# Phase 2: Core-3 Adoption & Rename - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 moves the three core Odoo client libraries from
`C:\dev\odoo-toolbox/packages/` into `godoo-ts/packages/`, renames them
from `@marcfargas/odoo-*` to `@godoo/*`, and lands them green on the
Phase-1 toolchain (pnpm + tsdown + Biome + vitest, Node 22 + 24 CI). The
three are adopted in **client → testcontainers → introspection** order,
because both testcontainers and introspection import the client and the
client's integration tests cannot pass until testcontainers is in place
(CORE-03 reactivation).

In scope: the destination/adopt side of the `godoo-adoption` protocol —
copy code, rename scope, rewrite imports, convert toolchain, fix
strict-TS gaps, delete the Phase-1 `packages/_example`, wire a Docker/Odoo
integration-test CI job, and verify all unit + integration tests pass
under `@godoo/*` on Node 22 + 24.

Out of scope: publishing to the public `@godoo/` npm scope (Phase 3 /
PUB-01..02), removing the adopted packages from `odoo-toolbox` (Phase 3 /
SHED-01..05), shedding non-core packages, retiring `odoo-toolbox`, and
any feature changes or API churn beyond what the rename forces (e.g.
import paths). The Phase-2 verification is purely "adopted, renamed, and
green inside godoo-ts" — source-side cleanup follows in Phase 3.

Satisfies requirements CORE-01, CORE-02, CORE-03, CORE-04, CORE-05.

</domain>

<decisions>
## Implementation Decisions

### Code-transfer mechanics

- **D-01:** **Fresh copy + `pre-adoption-baseline` tag** in `odoo-toolbox`
  is the transfer strategy. Before any adoption begins, tag
  `odoo-toolbox` at HEAD as `pre-adoption-baseline` (the
  `godoo-adoption-protocol.md` step-1 requirement). For each adopted
  package, **plain-copy** the package directory into
  `godoo-ts/packages/<new-name>/`. The adoption commit message references
  the source SHA, e.g.:
  `feat(client): adopt @marcfargas/odoo-client as @godoo/client (from odoo-toolbox@<sha>)`.
  Per-file blame is **not** preserved in godoo-ts; archaeology lives in
  the tagged source repo (and Phase 3 retires `odoo-toolbox` to a
  deprecation README that points here). No `git subtree split` /
  `git filter-repo` — synthetic-history complexity not worth the blame.

### Test-runner conversion

- **D-02:** **Jest → vitest conversion is one-pass, inside the same
  adoption commit** as the rename. `odoo-client` and `odoo-introspection`
  currently use `ts-jest`; `odoo-testcontainers` already uses vitest. For
  the two jest packages, the rename commit also: removes `jest`,
  `ts-jest`, `@types/jest` devDeps and `jest.config.*`; rewrites
  `jest.mock`/`jest.fn`/`jest.spyOn` to the `vi.*` equivalents; replaces
  jest-global types with `import { describe, it, expect, vi } from 'vitest'`
  where required; updates per-package `package.json` `test` script to
  `vitest run`. **No temporary dual-runner state.** Larger per-package
  diff is the explicit trade-off; matches the project's
  "modernize-in-one-pass" stance.

### Strict-TS conformance

- **D-03:** **Each adopted package must be strict-clean before the
  adoption plan completes.** That means: every public export has an
  explicit return type (Phase 1's `isolatedDeclarations: true`); zero
  `any` (Phase 1's `noExplicitAny: error`) — replaced with proper types
  or `unknown` + narrowing; zero `biome-ignore` or `// @ts-nocheck`
  suppressions remain in the adopted code; `pnpm biome check .`,
  `pnpm tsc --noEmit`, and `pnpm build` all exit 0 across the whole
  workspace after each package lands. The strict-fix work happens
  in-flight in the same plan as the rename — there is no follow-up
  "cleanup" plan and no per-package tsconfig/Biome relaxation.

### Integration-test CI (CORE-03)

- **D-04:** The Phase-1-deferred Docker/Odoo CI job is **added in this
  phase**, triggered **per-push on `develop` and `main`, and on PRs
  targeting either branch** — same trigger surface as the existing
  unit-test CI job, no path filtering, no nightly cron. Runs on the same
  Node 22 + 24 matrix as the unit job. Lands as a separate workflow job
  (e.g. `integration`) so a slow / flaky integration run can be
  identified independently of the fast unit job.

- **D-05:** Container orchestration for the integration job runs
  **entirely through `@godoo/testcontainers`** — the integration tests
  call into the testcontainers package, which manages Postgres + Odoo
  container lifecycle from inside the test process. **No** `services:`
  block, **no** `docker-compose.test.yml` (the source repo's compose file
  is not lifted). Single source of truth for container startup is the
  package being tested. The runner needs Docker available on the GitHub
  Actions runner (default on `ubuntu-latest`).

### Sequencing & boundaries

- **D-06:** Adoption order is locked: **(1) `@godoo/client` with
  integration tests temporarily skipped → (2) `@godoo/testcontainers`
  → (3) re-enable `@godoo/client` integration tests against the adopted
  testcontainers → (4) `@godoo/introspection`**. The skip step in (1)
  carries an inline TODO referencing CORE-03; step (3) deletes that
  TODO. This sequence flows directly from the dependency graph and
  PROJECT.md / ROADMAP.md and is not re-litigated by the planner.

- **D-07:** `packages/_example` is **deleted in the first adoption
  commit** (the one that introduces `@godoo/client`). The example was
  Phase-1 throwaway proof; real `@godoo/*` packages exercise the
  toolchain from this point on. Removing it earlier (before any real
  package) would leave the workspace transiently empty; removing it
  later would carry dead code through the whole phase.

### Claude's Discretion

- **Biome reformat pass on adopted code.** Phase-1 D-03 anticipated a
  one-time Biome reformat when source code lands. Fold this into the
  D-03 in-flight strict-TS pass — the same files are touched by both
  edits; splitting them is busywork.
- **`debug` dependency handling.** All three packages depend on
  `debug ^4.x`. Keep per-package (pnpm dedupes via the lockfile); no
  workspace catalog or root hoist unless dedup actually fails.
- **Cross-package workspace dependency style.** Use `workspace:*` for
  `@godoo/testcontainers` → `@godoo/client` and `@godoo/introspection`
  → `@godoo/client`. Pnpm-idiomatic; changesets resolves to the exact
  version at publish (Phase 3); least friction with the changesets +
  pnpm setup Phase 1 wired.
- **CHANGELOG / version baseline for the renamed packages.** The
  inherited package versions (`odoo-client@0.6.0`,
  `odoo-introspection@0.2.1`, `odoo-testcontainers@0.1.5`) and the new
  baseline under `@godoo/*` are **Phase 3's call**, not Phase 2's —
  the question is bound to the publish event, not the rename.
- **`godoo-adoption` branch on `odoo-toolbox`.** Per
  `godoo-adoption-protocol.md` the source-side branch is created when
  the destination starts removing/shedding. Phase 2 only tags
  `pre-adoption-baseline` in the source (read-only); branch creation
  and the source-side shed commits are Phase 3.
- **Per-package package.json metadata refresh.** During rename, also
  update `author`, `repository.url`, `repository.directory`, and
  `homepage` fields to point at `godoo-dev/godoo-ts`. Trivial; bundle
  with each rename commit.
- **Internal vitest config layout.** Whether each package gets a
  per-package `vitest.config.ts` or relies on the root config's
  `test.projects: ['packages/*']` is the planner's call; both work
  with the Phase-1 setup.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs

- `.planning/PROJECT.md` — Core value, Constraints (tech stack, license,
  process, dependency, coupling, reporting, umbrella wiring), Key
  Decisions table
- `.planning/REQUIREMENTS.md` §"Core-3 Adoption & Rename" — CORE-01..05
  requirement text
- `.planning/ROADMAP.md` §"Phase 2" — phase goal and the five success
  criteria
- `.planning/STATE.md` §"Blockers/Concerns" — `godoo-adoption` protocol +
  client/testcontainers test-coupling blockers (resolved by the
  sequencing in D-06)

### Phase-1 context (carries forward)

- `.planning/phases/01-repo-toolchain-bootstrap/01-CONTEXT.md` — toolchain
  decisions D-01..D-10 that constrain how adopted code must land
  (ESM-only tsdown, Biome `noExplicitAny: error`, lefthook hooks, CI
  matrix Node 22 + 24, branch protection on `main`)
- `.planning/phases/01-repo-toolchain-bootstrap/01-VERIFICATION.md` —
  authoritative inventory of Phase-1 files this phase builds on
  (tsconfig.base.json, biome.json, vitest.config.ts,
  `.github/workflows/ci.yml`, `packages/_example/*`)

### Umbrella / initiative

- `../godoo-hq/UMBRELLA_CLAUDE.md` — umbrella context (already
  `@`-imported from `CLAUDE.md`)
- `../godoo-hq/.planning/notes/godoo-adoption-protocol.md` — **canonical
  definition of the `godoo-adoption` branch protocol**. Phase 2 executes
  the destination/adopt side, steps 1–4 (clone source, adopt in
  dependency order, rename + refactor, run tests). Source-side
  shed steps and the satellite "publish under new scope" + "report back"
  steps are Phase 3 / Phase 4. Phase 2 must `pre-adoption-baseline`-tag
  the source per the source-side step 1.
- `SEED.md` — adoption brief that bootstrapped this GSD project (states
  the adoption order is dependency-driven; that is D-06)

### Source / modernization baseline (read-only, not in this repo)

- `C:\dev\odoo-toolbox/packages/odoo-client/` — source of `@godoo/client`.
  Currently `@marcfargas/odoo-client@0.6.0`, jest + ts-jest tests, `tsc`
  build, runtime dep `debug ^4.4.3`.
- `C:\dev\odoo-toolbox/packages/odoo-testcontainers/` — source of
  `@godoo/testcontainers`. Currently `@marcfargas/odoo-testcontainers@0.1.5`,
  vitest already, `tsc` build, depends on `@marcfargas/odoo-client
  ^0.5.1 || ^0.6.0` (rewrite to `workspace:*` → `@godoo/client`),
  `dockerode`, `testcontainers`, `@testcontainers/postgresql`.
- `C:\dev\odoo-toolbox/packages/odoo-introspection/` — source of
  `@godoo/introspection`. Currently `@marcfargas/odoo-introspection@0.2.1`,
  jest + ts-jest, `tsc` build, has a `bin` entry (`odoo-introspect` →
  `dist/cli/cli.js`) that must follow the tsdown `.mjs` output; depends
  on `@marcfargas/odoo-client ^0.6.0` (rewrite to `workspace:*` →
  `@godoo/client`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase-1 root toolchain** is the adoption substrate — all three
  packages plug into the existing `pnpm-workspace.yaml`,
  `tsconfig.base.json`, `biome.json`, `lefthook.yml`, root
  `vitest.config.ts` (`test.projects: ['packages/*']` auto-picks up new
  packages), and `.github/workflows/ci.yml`. No new root configuration
  is required for the unit-test side of adoption.
- **`packages/_example`** is the working reference for what a strict
  `@godoo/*` package looks like under this toolchain: ESM-only tsdown
  output (`dist/index.mjs` + `dist/index.d.mts`), `.js` import
  extensions in tests for `nodenext` resolution, `composite: true` in
  the per-package tsconfig, exports map pointing at `.mjs`/`.d.mts`.
  Each adopted `package.json` / `tsdown.config.ts` / `tsconfig.json`
  should mirror this shape before D-07 deletes the example.

### Established Patterns

- **Per-package tsconfig `extends`** the root `tsconfig.base.json` and
  sets `composite: true`. The root `tsconfig.json` lists packages in
  `references[]` — each adoption commit appends its entry.
- **Tests import source via `.js` extensions** under `nodenext`
  resolution (e.g. `from '../src/index.js'`) — this is `_example`'s
  convention and adopted tests must follow it.
- **Test files live in `tests/`** at the package root, not `__tests__/`
  or co-located `*.test.ts` (Phase-1 layout). Adopted jest test
  locations may need to be moved during the D-02 conversion.
- **No `.mjs`/`.d.mts` references in `exports`** is a known Phase-1
  pitfall (auto-fix #2 in 01-VERIFICATION.md). The tsdown 0.22.0 ESM
  output dictates the extension; every adopted `package.json` exports
  map must use `.mjs`/`.d.mts`, not `.js`/`.d.ts`.

### Integration Points

- **`packages/` workspace dir** is the integration point — the empty
  dir Phase 1 set up gets filled with three real `@godoo/*` packages.
- **GitHub Actions CI** gets a new `integration` job alongside the
  existing unit/build/typecheck/biome `ci` job. The job-naming question
  intersects with branch protection: Phase-1 D-09 set required status
  checks `ci (22)`, `ci (24)`; if the integration job blocks merges, the
  ruleset must add `integration (22)`, `integration (24)` to the
  required-status list.
- **`CLAUDE.md` umbrella import** (Phase-1 BOOT-04) is unaffected;
  Phase 2 does not touch it.

</code_context>

<specifics>
## Specific Ideas

- The first adoption commit (`@godoo/client`) **also deletes
  `packages/_example`** in the same diff (D-07).
- Each rename commit message follows the same template:
  `feat(<pkg>): adopt @marcfargas/odoo-<pkg> as @godoo/<pkg> (from odoo-toolbox@<sha>)`.
- The CORE-03 re-enable step gets its own commit, scoped to
  `packages/client/tests/integration/*` and the integration CI job
  toggle.
- `@godoo/introspection`'s `bin` entry must publish a runnable script
  pointing at the tsdown `.mjs` output (`dist/cli/cli.mjs`), not the
  inherited `dist/cli/cli.js`.
- Phase-2 verification runs `pnpm biome check .`, `pnpm tsc --noEmit`,
  `pnpm build`, `pnpm test` (unit), and the new integration job — all
  green, across the whole workspace, on Node 22 + 24.

</specifics>

<deferred>
## Deferred Ideas

- **Publishing `@godoo/*` to the public npm scope** (PUB-01..02) —
  Phase 3.
- **Source-side removal of adopted packages from `odoo-toolbox`**
  (SHED-01..05) and the `godoo-adoption` branch + deprecation README on
  the source side — Phase 3.
- **CHANGELOG / version baseline** for the renamed packages — bound to
  the publish event, decided in Phase 3.
- **Workspace catalog or root-hoist for `debug`** — only revisit if
  pnpm dedup actually fails.
- **Per-package CommonJS build override** (Phase-1 deferred item) — if
  any adopted consumer needs CJS, that override is taken in Phase 3 at
  publish time, not here.
- **Atlas-MCP salvage from `odoo-mcp`** — explicitly an
  Atlas-MCP-charter decision (PROJECT.md), not godoo-ts's.
- No scope creep raised during discussion — all four selected gray
  areas stayed inside the phase boundary.

</deferred>

---

*Phase: 2-Core-3 Adoption & Rename*
*Context gathered: 2026-05-21*
