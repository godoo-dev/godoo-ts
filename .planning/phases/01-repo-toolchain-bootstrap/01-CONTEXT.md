# Phase 1: Repo & Toolchain Bootstrap - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 stands up the **empty public `godoo-ts` monorepo and its complete
build/test/release toolchain**, wired into the godoo umbrella — an empty, green
vessel that Phase 2 pours the adopted core-3 packages into.

In scope: pnpm-workspace scaffold, root tsconfig + shared config, Biome
lint/format, lefthook hooks, tsup build config, vitest, changesets, GitHub
Actions CI, GitHub repo creation, and verifying the `CLAUDE.md` umbrella import.

Out of scope: adopting/renaming the actual `@godoo/*` packages (Phase 2),
publishing to npm (Phase 3), and any Docker/Odoo integration-test wiring
(Phase 2, coupled to `@godoo/testcontainers`).

Satisfies requirements BOOT-01, BOOT-02, BOOT-03, BOOT-04.

</domain>

<decisions>
## Implementation Decisions

### Green-toolchain proof (BOOT-03)
- **D-01:** Prove the toolchain green with **one throwaway example package**
  (e.g. `packages/_example`) containing a real `index.ts` and a trivial
  passing vitest test. It must genuinely exercise `pnpm install`, the tsup
  build, vitest, and `tsconfig` `extends`. Phase 2 deletes it once the real
  core-3 packages land. Do **not** scaffold empty skeletons of the three real
  packages — that would lock package-manifest shape before Phase 2 knows the
  adopted manifests.
- **D-02:** The **shared tsup config emits ESM-only output + `.d.ts`**
  declarations (no CommonJS). This is the default for every package; the
  exports map targets ESM consumers (Node 22+/modern bundlers).

### Lint / format toolchain
- **D-03:** Use **Biome** as the single lint+format tool (one `biome.json`),
  replacing odoo-toolbox's ESLint + Prettier. This is a deliberate
  "modernize in one pass" choice. Expect the Phase 2 adopted code may need a
  one-time Biome reformat pass.
- **D-04:** Enforce locally with **lefthook** — a pre-commit hook running
  Biome check on staged files. Replaces odoo-toolbox's husky + lint-staged.

### CI matrix & scope (BOOT-03)
- **D-05:** GitHub Actions test matrix runs on **Node 22 + Node 24** (the two
  currently-active LTS lines as of May 2026). Node 20 is excluded — it reached
  EOL in April 2026.
- **D-06:** CI runs on **Ubuntu only** (no Windows/macOS matrix). Local Windows
  development on marcwin provides de-facto Windows coverage.
- **D-07:** Phase 1 CI jobs: **Biome check, typecheck, tsup build, unit tests
  (vitest)** — all green against the example package. The **Docker/Odoo
  integration-test job is deferred to Phase 2** (CORE-03), where it lands
  alongside the integration code it tests. No no-op placeholder job in Phase 1.

### Repo & remote setup (BOOT-01)
- **D-08:** Phase 1 execution **creates the GitHub repo autonomously** via
  `gh repo create godoo-dev/godoo-ts --public` (LGPL-3.0), wires the `origin`
  remote, and pushes. The `godoo-dev` org already exists and `gh` is
  authenticated — the executor has the green light, no manual step needed.
- **D-09:** Repo **default branch = `main`** (the release branch), with a
  branch protection ruleset on `main` requiring **CI to pass before merge** and
  **no required reviews** (solo maintainer). `develop` is the day-to-day
  working branch. This mechanically enforces the "main only via merge/PR" rule.

### BOOT-04 status
- **D-10:** `CLAUDE.md` **already exists** and already `@`-imports
  `../godoo-hq/UMBRELLA_CLAUDE.md`. BOOT-04 is effectively satisfied — Phase 1
  only needs to **verify** the import resolves, not create it.

### Claude's Discretion
- Exact tsconfig file naming/layout (e.g. `tsconfig.base.json` + per-package
  `extends`), `biome.json` rule selection beyond Biome's recommended set,
  changesets config details (`@changesets/changelog-github`, base branch),
  the example package's internal name, `.gitignore`/README scaffolding, and
  pnpm/Node version pinning files are left to research and planning. Strict TS
  with no `any` is a hard project constraint and must be enforced.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs
- `.planning/PROJECT.md` — core value, constraints (tech stack, license,
  process), key decisions table
- `.planning/REQUIREMENTS.md` §"Repo & Toolchain Bootstrap" — BOOT-01..04
  requirement text
- `.planning/ROADMAP.md` §"Phase 1" — phase goal and the five success criteria

### Umbrella / initiative
- `../godoo-hq/UMBRELLA_CLAUDE.md` — the umbrella context that `CLAUDE.md`
  `@`-imports (BOOT-04 target). Verify the import resolves from a fresh clone.
- `SEED.md` — the adoption brief that bootstrapped this GSD project
- `../godoo-hq/.planning/notes/godoo-adoption-protocol.md` — the
  `godoo-adoption` branch protocol; **not** exercised in Phase 1 but the
  toolchain/branch setup must not contradict it (relevant from Phase 2 on)

### Modernization baseline (read-only reference, not in this repo)
- `C:\dev\odoo-toolbox` (root: `package.json`, `tsconfig.json`,
  `vitest.config.mts`, `vitest.integration.config.mts`,
  `vitest.packaging.config.mts`, `docker-compose.test.yml`) — the source
  repo's current toolchain (npm workspaces, ESLint+Prettier, husky, per-package
  `tsc`) that godoo-ts modernizes. Useful for understanding what the adopted
  packages currently expect; godoo-ts deliberately diverges (pnpm, tsup, Biome,
  lefthook).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — `godoo-ts` is a near-empty repo (`.planning/`, `CLAUDE.md`, `SEED.md`
  only). This phase creates the toolchain from scratch; there is no prior code
  to reuse.

### Established Patterns
- `CLAUDE.md` already follows the umbrella-import pattern
  (`@../godoo-hq/UMBRELLA_CLAUDE.md`) — preserve it.
- The source repo `odoo-toolbox` establishes the *prior* patterns being
  deliberately replaced: npm workspaces → pnpm workspaces; per-package `tsc`
  → shared tsup; ESLint+Prettier → Biome; husky+lint-staged → lefthook.

### Integration Points
- New origin remote: `godoo-dev/godoo-ts` on GitHub (created during execution).
- The empty `packages/` workspace dir is the integration point Phase 2 fills
  with the adopted `@godoo/client`, `@godoo/introspection`,
  `@godoo/testcontainers`.

</code_context>

<specifics>
## Specific Ideas

- Toolchain target shape: pnpm workspaces · root tsconfig + per-package
  `extends` · shared tsup config (ESM-only) · Biome (`biome.json`) · lefthook
  · vitest · changesets · GitHub Actions.
- The example package is explicitly **disposable** — its only job is to make
  `pnpm install` + tsup build + vitest demonstrably green in Phase 1; Phase 2
  removes it.

</specifics>

<deferred>
## Deferred Ideas

- **Docker/Odoo integration-test CI job** — deferred to Phase 2 (CORE-03),
  where it lands with the `@godoo/testcontainers` adoption and the re-enabled
  `@godoo/client` integration suite.
- **Per-package build-format overrides** — if any adopted package turns out to
  need CommonJS output, that override is a Phase 2 decision; Phase 1 sets the
  ESM-only default.
- No scope creep raised — discussion stayed within phase boundary.

</deferred>

---

*Phase: 1-Repo & Toolchain Bootstrap*
*Context gathered: 2026-05-19*
