# Phase 1: Repo & Toolchain Bootstrap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 1-Repo & Toolchain Bootstrap
**Areas discussed:** Green-toolchain proof, Lint/format tool, CI matrix & scope, Repo & remote setup

---

## Green-toolchain proof

### How to prove the toolchain green when packages arrive in Phase 2

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder example package | One throwaway package with real `index.ts` + a trivial passing vitest test; exercises tsup build, vitest, tsconfig extends; Phase 2 deletes it | ✓ |
| Empty skeletons of the 3 packages | Scaffold `packages/client`, `introspection`, `testcontainers` stubs now | |
| No-op-green config | Configure workspace to pass with an empty `packages/` dir | |

**User's choice:** Placeholder example package
**Notes:** Avoids locking package-manifest shape before Phase 2 knows the adopted manifests; genuinely exercises the wiring end-to-end.

### Shared tsup output format

| Option | Description | Selected |
|--------|-------------|----------|
| ESM-only + .d.ts | Emit ESM + TypeScript declarations only | ✓ |
| Dual ESM + CJS + .d.ts | Emit both module systems for max consumer compat | |
| Decide per-package in Phase 2 | Defer the format call to package adoption | |

**User's choice:** ESM-only + .d.ts
**Notes:** Cleanest, modern, smallest config for a fresh 2026 toolchain.

---

## Lint/format tool

### Lint/format toolchain choice

| Option | Description | Selected |
|--------|-------------|----------|
| Biome | Single Rust-based tool for lint + format, one `biome.json` | ✓ |
| ESLint + Prettier (carried) | Keep odoo-toolbox's existing tooling, zero adoption friction | |
| ESLint flat config + Prettier, refreshed | Modernized ESLint 9 flat config, same tooling family | |

**User's choice:** Biome
**Notes:** Fits the "modernize the toolchain in one pass" mandate. Accepts a possible one-time reformat pass on the Phase 2 adopted code.

### Pre-commit / local enforcement strategy

| Option | Description | Selected |
|--------|-------------|----------|
| lefthook | Single Go binary, YAML config, runs Biome on staged files | ✓ |
| husky + lint-staged | The pattern odoo-toolbox already uses | |
| CI-only, no local hooks | Biome runs only as a CI job | |

**User's choice:** lefthook
**Notes:** Pairs naturally with the Biome modernization choice; no Node-script indirection.

---

## CI matrix & scope

### Node.js version coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Matrix: Node 22 + 24 | Both currently-active LTS lines | ✓ |
| Single: Node 22 LTS | One version, fastest CI | |
| Matrix: Node 20 + 22 + 24 | Widest net, includes EOL Node 20 | |

**User's choice:** Matrix: Node 22 + 24
**Notes:** Node 20 reached EOL in April 2026; testing it would spend CI on an unsupported runtime.

### CI OS coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Ubuntu only | Single OS, leanest matrix, native Docker for integration tests | ✓ |
| Ubuntu + Windows | Adds explicit Windows CI (4 jobs) | |
| Ubuntu + Windows + macOS | Full 3-OS matrix (6 jobs) | |

**User's choice:** Ubuntu only
**Notes:** Local development on marcwin provides de-facto Windows coverage.

### Docker/Odoo integration-test job

| Option | Description | Selected |
|--------|-------------|----------|
| Defer integration job to Phase 2 | Phase 1 CI = lint/typecheck/build/unit only; integration job added in Phase 2 (CORE-03) | ✓ |
| Scaffold integration job now (no-op) | Include the integration job structure now, running nothing | |
| Single combined test step | One 'test' step, reworked in Phase 2 | |

**User's choice:** Defer integration job to Phase 2
**Notes:** Integration wiring is coupled to `@godoo/testcontainers` and should land with the code it tests — no dead job in Phase 1.

---

## Repo & remote setup

### Repo creation & remote wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Autonomous via gh CLI | Execution runs `gh repo create godoo-dev/godoo-ts --public`, wires origin, pushes | ✓ |
| You create it, executor wires remote | Manual repo creation, executor adds remote + pushes | |
| You handle repo + remote entirely | Manual repo + remote, executor skips GitHub setup | |

**User's choice:** Autonomous via gh CLI
**Notes:** `godoo-dev` org exists and `gh` is authenticated; selecting this in discussion gives the executor durable authorization.

### Default branch & protection

| Option | Description | Selected |
|--------|-------------|----------|
| Default main + protect main | Default branch `main`, branch protection requires CI pass, no required reviews | ✓ |
| Default main, no protection | Default `main`, no protection rules | |
| Default develop | Make `develop` the repo default branch | |

**User's choice:** Default main + protect main
**Notes:** Mechanically enforces the "main only via merge/PR" rule; no required reviews since solo maintainer.

---

## Claude's Discretion

- tsconfig file naming/layout, `biome.json` rule selection beyond recommended, changesets config details, example package internal name, `.gitignore`/README scaffolding, pnpm/Node version pinning files — left to research and planning.

## Deferred Ideas

- Docker/Odoo integration-test CI job — deferred to Phase 2 (CORE-03).
- Per-package build-format overrides (if any adopted package needs CommonJS) — a Phase 2 decision; Phase 1 sets the ESM-only default.
- No scope creep raised — discussion stayed within phase boundary.
