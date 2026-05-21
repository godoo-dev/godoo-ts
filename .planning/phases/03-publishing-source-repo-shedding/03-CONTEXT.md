# Phase 3: Publishing & Source-Repo Shedding - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 takes the three already-adopted `@godoo/*` core packages live on
the public npm scope, deprecates every retiring `@marcfargas/odoo-*`
package on the registry, and retires the source repo `odoo-toolbox` to
an archived deprecation README. This is the **publishing + source-side
shed** half of the `godoo-adoption` protocol — Phase 2 was the
destination-side adoption; Phase 3 closes the loop so the codebase ends
up in exactly one repo with the `@godoo/` scope as its only canonical
home.

In scope:
- Create the public `@godoo` npm org (free tier; public packages only).
- Bootstrap each of the three core packages on npm via a minimal `0.0.0`
  stub publish from the laptop, so npm trusted publishing can be
  configured against an existing package.
- Configure npm OIDC trusted publishing for `@godoo/client`,
  `@godoo/introspection`, `@godoo/testcontainers` against the
  `godoo-dev/godoo-ts` GitHub Actions workflow.
- Wire `changesets/action` (or equivalent) into the release workflow so
  the next merge to `main` publishes the real first releases at the
  inherited versions (`@godoo/client@0.6.0`,
  `@godoo/introspection@0.2.1`, `@godoo/testcontainers@0.1.5`) with
  automatic SLSA provenance attestations.
- Seed a single rename-changeset per package so the first real publish
  has a meaningful CHANGELOG.md entry.
- Deprecate all seven retiring `@marcfargas/odoo-*` packages on the
  registry via `npm deprecate '<pkg>@*' "<msg>"` with per-package
  messages (see D-04). No final release for any of them.
- Execute the source-side shed on `odoo-toolbox` under a
  `godoo-adoption` branch in **two PRs**: PR1 removes
  `packages/{odoo-client,odoo-introspection,odoo-testcontainers}`
  (adopted as one coupled unit); PR2 winds down the non-adopted
  leftovers (`packages/odoo-state-manager`, `packages/odoo-skills`,
  `packages/odoo-test-harness`, `targets/odoo-cli`), rewrites the repo
  README to a deprecation pointer, and renames `master` → `main`.
  **`targets/odoo-mcp/` is preserved** in the archived tree as the
  canonical salvage source for a future Atlas MCP charter.
- GitHub-archive `odoo-toolbox` (read-only) after PR2 merges, so the
  `pre-adoption-baseline` tag and the salvage `targets/odoo-mcp/` tree
  remain queryable but the repo signals "frozen" unambiguously.

Out of scope:
- The terminal report-back entry to `godoo-hq/dev-log.md` — that is
  Phase 4 (RPT-01).
- Any API change, codegen change, or feature evolution to the three
  `@godoo/*` packages — Phase 3 is publish + rename CHANGELOG only.
- A compatibility shim between `@marcfargas/odoo-state-manager` and
  `godoo-stateman` — explicit `Out of Scope` per PROJECT.md; the
  internal BGBL consumer migrates on its own timeline.
- Salvaging any code from `odoo-mcp` into a new package — explicitly
  the Atlas MCP charter's decision, not this satellite's.

Satisfies requirements PUB-01, PUB-02, SHED-01, SHED-02, SHED-03,
SHED-04, SHED-05.

</domain>

<decisions>
## Implementation Decisions

### Version baseline for first publish

- **D-01:** **Carry inherited versions unchanged.** First publishes
  under the `@godoo/` scope land at `@godoo/client@0.6.0`,
  `@godoo/introspection@0.2.1`, `@godoo/testcontainers@0.1.5` — the
  versions already in each package's `package.json`. Rationale: the
  rename is a pure scope-identifier change with no API change, so
  semver doctrine does not justify a bump or a reset; the inherited
  versions preserve the real maturity spread (mature client /
  usable introspection / usable testcontainers) as a useful signal to
  new adopters; since the npm scope is part of the package name,
  `@marcfargas/odoo-client@^0.6.0` will never resolve to `@godoo/client`
  regardless of number, so there is zero downstream-resolution risk.
  Each first publish seeds its CHANGELOG.md with a single
  "renamed from `@marcfargas/odoo-<pkg>`" entry at the inherited
  version.

### Publish auth + release flow

- **D-02:** **Stub-bootstrap + OIDC trusted publishing for ongoing
  releases.** Create the `@godoo` npm org (free tier, public-only).
  Publish a minimal `0.0.0` stub for each of the three packages from
  the laptop (`pnpm publish` with 2FA OTP) — each stub contains a
  trimmed `package.json` (name, version `0.0.0`, README pointer,
  `publishConfig.access: public`) and a `main` entry that
  `throw`s a "this is a placeholder; install the real release once
  published" message so no one accidentally consumes the stub. After
  all three stubs are live, configure per-package **npm trusted
  publishers** on npmjs.com binding each to the
  `godoo-dev/godoo-ts` repo + the release workflow + a chosen GitHub
  environment. Real first releases (D-01 versions) are then driven by
  `changesets/action` (or equivalent) in a GitHub Actions workflow
  with `id-token: write`, npm CLI pinned to `>=11.5.1`, and `--provenance`
  enabled — yielding SLSA provenance attestations from v1 onward.
  Trusted publishers must be configured explicitly choosing the
  "allow npm publish" action (npm defaults changed on 2026-05-20).

- **D-03:** **Granular `@godoo/*`-scoped classic NPM_TOKEN kept as a
  documented break-glass.** Add the token as a repo secret
  (e.g. `NPM_TOKEN_BREAKGLASS`) with a one-paragraph README note
  pointing to the active scoped-OIDC bug (`npm/cli#8976` —
  scoped-package E404 via `changesets/action`). The release workflow
  uses OIDC by default; the token is only swapped in if OIDC fails for
  a known-upstream reason. Rotate annually or on incident.

### Deprecation mechanics (@marcfargas/* wind-down)

- **D-04:** **Registry-side `npm deprecate '<pkg>@*' "<msg>"` only, no
  final release.** Apply to all seven retiring packages in one
  scripted pass (locally, OTP, per package). No code change, no new
  publish — the protocol's no-dual-maintenance principle forbids
  shipping noise on a repo whose code is leaving. Per-package message
  templates:
  - `@marcfargas/odoo-client`:
    `"Renamed to @godoo/client. Install that package instead — see https://github.com/godoo-dev/godoo-ts."`
  - `@marcfargas/odoo-introspection`:
    `"Renamed to @godoo/introspection. Install that package instead — see https://github.com/godoo-dev/godoo-ts."`
  - `@marcfargas/odoo-testcontainers`:
    `"Renamed to @godoo/testcontainers. Install that package instead — see https://github.com/godoo-dev/godoo-ts."`
  - `@marcfargas/odoo-state-manager`:
    `"Superseded by godoo-stateman (Python). No JS shim — see https://github.com/godoo-dev for the godoo initiative."`
  - `@marcfargas/odoo-cli`:
    `"Deprecated. No direct replacement — see https://github.com/godoo-dev for the godoo initiative."`
  - `@marcfargas/odoo-mcp`:
    `"Deprecated. Source preserved for future salvage at https://github.com/marcfargas/odoo-toolbox (archived) targets/odoo-mcp/."`
  - `@marcfargas/odoo-skills`:
    `"Deprecated. CI-generated knowledge modules — future home TBD in the Atlas KB."`

  All seven publication statuses verified live during this discussion
  (npm view confirmed `@marcfargas/odoo-skills@0.5.3` is published, so
  it is included in the wind-down).

### Source-side shed sequencing + retirement form

- **D-05:** **Two-PR shed on `odoo-toolbox`, both on a single
  `godoo-adoption` branch.** PR1 removes the three core package
  directories that godoo-ts now carries: `packages/odoo-client/`,
  `packages/odoo-introspection/`, `packages/odoo-testcontainers/`,
  plus their references from the root `package.json` workspaces and
  the npm-workspaces build script chain. One commit per package
  preserves bisectability against the `pre-adoption-baseline` tag.
  PR2 winds down the non-adopted leftovers and writes the retirement
  README (see D-06). Both PRs are merged into `master` on the source
  repo via the `godoo-adoption` branch per the protocol.

- **D-06:** **PR2 contents — non-core wind-down + retirement README +
  branch rename.** PR2 removes `packages/odoo-state-manager/`,
  `packages/odoo-skills/`, `packages/odoo-test-harness/`, and
  `targets/odoo-cli/`. PR2 **preserves `targets/odoo-mcp/`** as the
  canonical salvage source for a future Atlas MCP charter. PR2
  replaces the root `README.md` with a deprecation README that:
  - Names the new homes on npm: `@godoo/client`, `@godoo/introspection`,
    `@godoo/testcontainers`.
  - Links to `godoo-dev/godoo-ts` on GitHub for ongoing development.
  - Notes `godoo-stateman` as the successor to `odoo-state-manager`
    (no shim, on its own timeline).
  - Names `targets/odoo-mcp/` as the in-tree salvage source for a
    future Atlas MCP charter, linking the directory.
  - Links the `pre-adoption-baseline` git tag for any historical
    builds.
  - Carries the LGPL-3.0 notice forward.

  PR2 also trims root `package.json` / `tsconfig.json` /
  `vitest.config.mts` / `vitest.integration.config.mts` /
  `vitest.packaging.config.mts` / `docker-compose.test.yml` / `docker/`
  / `scripts/` / `tests/` / `dist-plugins/` / `dist-skills/` /
  `targets/` (minus `odoo-mcp/`) / `docs/` / `skills/` /
  `experiments/` / `test-addons/` / `package-lock.json` so the
  archived tree is just `README.md` + LGPL `LICENSE` +
  `targets/odoo-mcp/` + the git tag history. **After PR2 merges,
  rename `master` → `main`** (matching the project's "main is
  release, develop is working" convention) and then **GitHub-archive
  the repo (read-only)**.

### Claude's Discretion

- **Stub package.json shape.** Whether the stub uses
  `"main": "./index.js"` with `index.js` containing
  `throw new Error("Placeholder for trusted publishing setup. Install the latest release.")`
  vs setting `"private": false` + `"main": "./placeholder.cjs"` etc.
  is a planner-level choice. Constraint: `name`, `version: "0.0.0"`,
  `publishConfig.access: "public"`, `license: "LGPL-3.0"`, `repository`
  pointing at `godoo-dev/godoo-ts`, and a runnable error-throwing main
  are non-negotiable.
- **Stub publish location — git tracked or not.** The stubs are
  ephemeral (they exist only on the npm registry to anchor trusted
  publishing). Keeping them in a single throwaway commit on a
  short-lived `release/stub-bootstrap` branch that is deleted after
  trusted publishing is configured is the cleanest approach, but the
  planner may pick a different scaffold style if it fits the existing
  workflow better.
- **Release workflow choice.** `changesets/action` is the
  default-recommended path; if the planner finds a friction during
  research (e.g. scoped-package E404 still active and not worked
  around), they may switch to a manual `pnpm changeset version` +
  `pnpm -r publish --provenance` workflow keeping the OIDC posture.
- **GitHub environment for the release workflow.** Whether the
  `id-token: write` workflow runs under a dedicated GitHub environment
  (`production`-style with required-reviewer = self) or directly is the
  planner's call — npm trusted publishers can be scoped to a specific
  environment if helpful.
- **Deprecation script form.** Whether the seven `npm deprecate`
  commands are executed by a `scripts/deprecate-marcfargas.sh` helper
  committed to `godoo-ts` for audit, or run ad-hoc and noted in the
  Phase 3 commits, is the planner's call.
- **Trusted-publisher PRs on `odoo-toolbox`.** Since the source repo
  is already using OIDC for `@marcfargas/odoo-skills` per the npm
  metadata (`published by GitHub Actions <npm-oidc-no-reply@github.com>`),
  the existing trusted publishers on `marcfargas/odoo-toolbox` for
  `@marcfargas/*` packages can be removed at archive time. Planner's
  discretion whether to remove before archiving (clean) or just let
  the archive freeze the configuration in place.
- **Order of operations within Phase 3.** The recommended sequence is
  (1) create `@godoo` org → (2) stub-bootstrap 3 packages → (3)
  configure trusted publishers → (4) wire release workflow + seed
  rename-changesets on `develop` → (5) merge to `main` to trigger the
  first real publish at D-01 versions → (6) deprecate the seven
  `@marcfargas/*` packages → (7) execute PR1 + PR2 on `odoo-toolbox`
  → (8) rename `master`→`main` → (9) GitHub-archive. Planner may
  reorder (6) anywhere after (5) lands.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs

- `.planning/PROJECT.md` — Core value, Constraints, Out of Scope
  (especially the "no shim for state-manager", "code left in place for
  mcp" rules), Key Decisions table
- `.planning/REQUIREMENTS.md` §"Publishing" and §"Source-Repo Shedding"
  — PUB-01..02 and SHED-01..05 requirement text
- `.planning/ROADMAP.md` §"Phase 3" — phase goal and the four success
  criteria

### Prior phase context (carries forward)

- `.planning/phases/01-repo-toolchain-bootstrap/01-CONTEXT.md` — D-08
  (repo created via `gh` autonomously), D-09 (branch protection on
  `main` requires CI), changesets config already wired with
  `access: public` and `repo: godoo-dev/godoo-ts`
- `.planning/phases/02-core-3-adoption-rename/02-CONTEXT.md` — D-01
  (transfer strategy + `pre-adoption-baseline` tag), the
  `workspace:*` cross-package deps that changesets will resolve to
  concrete versions at this phase's publish, the
  `dist/index.mjs`/`dist/cli/cli.mjs` exports map shape that publish
  must respect
- `.planning/phases/02-core-3-adoption-rename/02-VERIFICATION.md` —
  authoritative inventory of the green Phase-2 state Phase 3
  publishes from

### Umbrella / initiative

- `../godoo-hq/UMBRELLA_CLAUDE.md` — umbrella context (already
  `@`-imported from `CLAUDE.md`); the `siblings-never-nested` and
  `no-copies` rules apply to the retirement README's framing
- `../godoo-hq/.planning/notes/godoo-adoption-protocol.md` — the
  protocol's **destination-side step 5** (publish under new scope) is
  what D-01..D-03 implement; **source-side steps 2–3** (remove each
  package as adopted, then write deprecation README and merge
  `godoo-adoption` to `main`) are what D-05..D-06 implement
- `../godoo-hq/.planning/notes/report-back-mechanism.md` — defines
  what Phase 4 will do once Phase 3 is verified; Phase 3 does **not**
  file the report-back
- `SEED.md` — adoption brief at the repo root (first commit of this
  satellite)

### Source repo state (read-only, not in this repo)

- `C:\dev\odoo-toolbox\packages\odoo-client\` — to be removed in PR1
- `C:\dev\odoo-toolbox\packages\odoo-introspection\` — to be removed
  in PR1
- `C:\dev\odoo-toolbox\packages\odoo-testcontainers\` — to be removed
  in PR1
- `C:\dev\odoo-toolbox\packages\odoo-state-manager\` (currently
  `@marcfargas/odoo-state-manager@0.4.1`) — to be removed in PR2
- `C:\dev\odoo-toolbox\packages\odoo-skills\` (currently
  `@marcfargas/odoo-skills@0.5.3`, CC0-1.0, already publishes via
  OIDC) — to be removed in PR2
- `C:\dev\odoo-toolbox\packages\odoo-test-harness\` (already
  near-empty leftovers) — to be removed in PR2
- `C:\dev\odoo-toolbox\targets\odoo-cli\` (currently
  `@marcfargas/odoo-cli@0.3.3`) — to be removed in PR2
- `C:\dev\odoo-toolbox\targets\odoo-mcp\` (currently
  `@marcfargas/odoo-mcp@0.1.4`) — **preserved** through PR2 as
  Atlas-MCP salvage source
- Git tag `pre-adoption-baseline` on `odoo-toolbox` — already exists
  (Phase 2 created it); referenced by the retirement README
- Default branch `master` on `odoo-toolbox` (renamed to `main` in
  PR2's tail)

### npm registry references (verify before planning)

- `npm view @marcfargas/odoo-client` / `…/odoo-introspection` /
  `…/odoo-testcontainers` / `…/odoo-cli` / `…/odoo-mcp` /
  `…/odoo-state-manager` / `…/odoo-skills` — confirm latest published
  versions and OIDC-vs-token publisher metadata before issuing
  `npm deprecate`. As of 2026-05-21: all seven are published.
- npm Trusted Publishing docs at https://docs.npmjs.com/trusted-publishers/
  — gated upstream feature; planner should confirm current status
  (GA since 2025-07; default behaviour changed 2026-05-20).
- Known active issue `npm/cli#8976` — scoped-package E404 with
  `changesets/action` + OIDC; planner should check whether still open
  before locking the workflow choice.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase-1 changesets wiring** is the publish substrate.
  `.changeset/config.json` already has
  `["@changesets/changelog-github", { "repo": "godoo-dev/godoo-ts" }]`,
  `commit: false`, `access: public`, `baseBranch: main`. No config
  change needed for publishing.
- **All three core packages already have publish-ready package.json
  fields**: `publishConfig.access: public`,
  `repository.url: https://github.com/godoo-dev/godoo-ts.git`,
  `repository.directory: packages/<pkg>`,
  `homepage: https://github.com/godoo-dev/godoo-ts/tree/main/packages/<pkg>`,
  `license: LGPL-3.0`.
- **Phase-1 CI workflow `.github/workflows/ci.yml`** exists with
  Node 22 + 24 matrix on `ubuntu-latest`. Phase 3 adds a release
  workflow (separate file) — not by extending `ci.yml`.
- **Existing OIDC posture in the source repo** —
  `@marcfargas/odoo-skills` is published via OIDC
  (`published by GitHub Actions <npm-oidc-no-reply@github.com>`), so
  the maintainer's npm account already knows the trusted-publishing
  flow and the `godoo-dev` GitHub org's OIDC issuer is established
  ground. Bootstrap experience exists.

### Established Patterns

- **`workspace:*` cross-package deps** (Phase 2 D-08) are resolved by
  changesets to concrete version ranges at publish time —
  `@godoo/testcontainers` depends on `@godoo/client@workspace:*` and
  `@godoo/introspection` depends on `@godoo/client@workspace:*`. At
  publish, these become caret-or-tilde-pinned to the matching
  `@godoo/client` version published in the same release.
- **ESM-only output** — `tsdown` emits `dist/index.mjs` +
  `dist/index.d.mts`; the exports map already references the `.mjs`
  paths. Publish includes only the `dist/` directory + `package.json`
  + LICENSE + README via npm's default include logic; planner should
  add an explicit `files` field if not already present.
- **Bin entry handling for `@godoo/introspection`** —
  `"bin": { "odoo-introspect": "./dist/cli/cli.mjs" }`; the `.mjs`
  file already carries a shebang and execute permission
  (Phase 2 D-11). No special publish handling needed.

### Integration Points

- **GitHub Actions release workflow** is a new file added in this
  phase (`.github/workflows/release.yml` or similar). It triggers on
  push to `main`, runs `changesets/action` with `id-token: write` and
  `--provenance`, and consumes the seeded rename changesets.
- **GitHub branch protection on `main`** (Phase 1 D-09) currently
  requires the four CI status checks
  (`ci (22)`, `ci (24)`, `integration (22)`, `integration (24)`).
  The release workflow can run on the same `main` push without
  changes to the ruleset, but if the planner adds a "release" status
  check, the ruleset must be updated to require it.
- **The retirement README on `odoo-toolbox`** is the link target for
  D-04's deprecation messages naming the source repo; the URL is
  `https://github.com/marcfargas/odoo-toolbox` (will read "archived"
  after the GitHub-archive step).

</code_context>

<specifics>
## Specific Ideas

- **Stub package main behaviour:** `throw new Error(...)` (not just a
  `console.warn` and continue) — the stub should be impossible to
  accidentally consume.
- **Stub publish commit:** ephemeral, on a short-lived
  `release/stub-bootstrap` branch deleted after trusted publishers are
  wired — not on `develop` or `main`.
- **One rename-changeset per package** for the first real publish.
  Three changeset markdown files, each with a `patch`-level bump
  (versions stay at the inherited numbers; changesets respects the
  current package.json version as baseline) and a `## @godoo/<pkg>`
  heading with the rename note.
- **Deprecation messages exactly as in D-04** — no improvisation in
  wording when the messages reach the registry; copy-paste from this
  CONTEXT.md.
- **PR2 retirement README must link `targets/odoo-mcp/` explicitly**
  by relative path so the archived-repo viewer can navigate to the
  salvage source in two clicks.
- **`master`→`main` rename on `odoo-toolbox` happens AFTER PR2 merges
  but BEFORE GitHub-archive** — once archived, the rename is no
  longer possible.

</specifics>

<deferred>
## Deferred Ideas

- **Terminal report-back to `godoo-hq/dev-log.md`** (RPT-01) — Phase 4.
- **Salvaging code from `targets/odoo-mcp/` into an Atlas MCP build**
  — Atlas MCP charter's decision, not this satellite's; the salvage
  source is preserved in the archived `odoo-toolbox` per D-06.
- **Compatibility shim between `@marcfargas/odoo-state-manager` and
  `godoo-stateman`** — explicit Out-of-Scope per PROJECT.md.
- **CommonJS dual build for any `@godoo/*` package** — Phase-1
  deferred; revisit only when a real CJS-only consumer surfaces.
- **Re-publishing the three `@godoo/*` packages with their inherited
  CHANGELOG histories** carried forward from the `@marcfargas/odoo-*`
  CHANGELOG.md files — explicit choice in D-01 is to **seed fresh**
  CHANGELOG.md on the new scope at the inherited version. The
  archived `odoo-toolbox` carries the historical CHANGELOGs at the
  `pre-adoption-baseline` tag for archaeology.
- **A `marcfargas/odoo-toolbox` GitHub Sponsors / npm-funding
  redirect** — out of scope for this phase; the deprecation
  README + npm deprecation messages are the migration surface.
- **Removing the existing OIDC trusted publishers for `@marcfargas/*`
  packages on the `marcfargas/odoo-toolbox` repo** before archiving —
  Claude's Discretion / planner's call (see D-decisions discretion
  bullet).
- No scope creep raised during discussion — all four selected gray
  areas and all three follow-ups stayed inside the phase boundary.

</deferred>

---

*Phase: 3-Publishing & Source-Repo Shedding*
*Context gathered: 2026-05-21*
