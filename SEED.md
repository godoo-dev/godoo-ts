# godoo-ts — Project Seed

> The TypeScript monorepo for the godoo library family — adopts the core 3 Odoo client libraries from `odoo-toolbox`, renames them under the `@godoo/` npm scope, and publishes them as the TS surface of the Odoo Atlas initiative.

**Seed written:** 2026-05-18
**Status:** Pre-charter. This document is the input to a `/gsd:new-project` pass.

---

## 0. Orientation — read this first

You may be reading this in a freshly-cloned repo with no other context. Here is what you need to know before anything else.

**The `godoo-dev` umbrella / Odoo Atlas initiative.** `godoo-dev` is a multi-repo initiative — the *godoo / Odoo Atlas initiative* — to consolidate scattered Odoo tooling into a coherent, independently shippable family of repos, all coordinated from a single vantage-point repo (the *spine*, `godoo-hq`). **The godoo library family** is the core of that initiative: the TypeScript library monorepo (`godoo-ts`), its Python twin (`godoo-py`), and the Python state manager (`godoo-stateman`).

**What this document is — an adoption brief.** This `SEED.md` is an *adoption brief*: a self-orienting charter that seeds this repo. It is committed as `godoo-ts`'s first commit and is consumed directly as the `/gsd:new-project` input that bootstraps `godoo-ts`'s own Layer-1 GSD project. It states what the satellite is for, what it must deliver, and how it relates to the rest of the initiative — enough to plan the satellite's work without consulting any other repo first.

**What `godoo-ts` is adopting, and why.** `godoo-ts` consolidates the TypeScript "core-3" Odoo client packages into a clean, purpose-built monorepo. The packages currently live in `odoo-toolbox` — a broader, mixed-purpose repo. `godoo-ts` adopts the three core libraries (renamed under the `@godoo/` scope), ejects everything non-core, and `odoo-toolbox` is then **shed/retired** as the source repo. The result is a single canonical TS home for these libraries.

**Umbrella context.** This brief assumes the shared umbrella context and does not restate it. Load it: `@../godoo-hq/UMBRELLA_CLAUDE.md` — the single-sourced "what every umbrella project must know" file (initiative goal, three-layer architecture, the spine, full topology, and the load-bearing coordination rules), imported by every project under the `godoo-dev` umbrella.

The permanent trace of this brief in the spine is the Phase 3 entry in `godoo-hq/dev-log.md`. No copy of this file lives in the spine — consistent with the no-copies / vantage-point principle, the full brief lives here, in the satellite repo.

---

## 1. Vision — what this satellite holds

`godoo-ts` is the renamed, slimmed `odoo-toolbox` TypeScript monorepo. It holds:

- **`@godoo/client`** — the core Odoo JSON-RPC client library
- **`@godoo/introspection`** — the Odoo schema introspection library
- **`@godoo/testcontainers`** — the Odoo testcontainers integration library

These three packages form the TS surface of the **Odoo Atlas core-3 library parity scope**. They are renamed from the `@marcfargas/odoo-*` scope to `@godoo/*` and published under the `@godoo/` npm scope. `godoo-ts` is the canonical TS home for these libraries going forward.

---

## 2. Code to adopt

**Source repo:** `odoo-toolbox` at `C:\dev\odoo-toolbox`

| Package (old name) | New name | Maturity | Source LOC / Test LOC |
|--------------------|----------|----------|----------------------|
| `@marcfargas/odoo-client` | `@godoo/client` | MATURE | 5,418 / 4,807 |
| `@marcfargas/odoo-introspection` | `@godoo/introspection` | USABLE | 1,360 / 851 |
| `@marcfargas/odoo-testcontainers` | `@godoo/testcontainers` | USABLE | 1,381 / 549 |

**Adoption order (dependency- and test-coupling-driven):**

- **Wave 1 — `@godoo/client` + `@godoo/testcontainers` (coupled pair).** These two cannot be cleanly validated in isolation from each other and so are adopted together as the first wave. The coupling is two-directional: `@godoo/testcontainers` peer-depends on `@godoo/client` (runtime import graph), AND `@godoo/client`'s own integration test suite depends on `@godoo/testcontainers` — running the client's integration tests requires real Odoo containers, which `testcontainers` provides. Adopting the client strictly alone leaves it not *fully validated*, since its integration tests cannot run.
- **Wave 2 — `@godoo/introspection`.** Depends only on `@godoo/client` and has no test-time coupling back to it; adopt after the client is stable.

Rationale: every non-client package imports from `@marcfargas/odoo-client`, so renaming any of them before the client rename is finalised would create a period of mixed scopes and force two passes of `import` path updates — hence the client must lead. The complication is `@godoo/client` ↔ `@godoo/testcontainers`: beyond the runtime peer-dependency, the client's *integration* test suite spins up real Odoo containers via `@godoo/testcontainers`, so the client cannot be declared "done" on tests alone if `testcontainers` has not been adopted. The satellite picks one of two valid resolutions during its own planning:

  1. **Coupled first wave** — adopt and stabilise `@godoo/client` and `@godoo/testcontainers` *together*, renaming both before declaring the client done, so the client's integration tests run against the adopted `testcontainers` from the start.
  2. **Client-first with deferred integration tests** — adopt `@godoo/client` first with its `testcontainers`-dependent (integration) tests temporarily disabled/skipped, then adopt `@godoo/testcontainers` and re-enable those tests, completing the client's validation.

  Either way `@godoo/introspection` follows once the client is stable.

**Ejected packages (NOT adopted into godoo-ts core):**

- `odoo-skills` (27 skill files) — goes to the Atlas KB. Already removed from git tracking in `odoo-toolbox`; CI-generated. Do not carry into `godoo-ts`.
- `odoo-cli` — deprecate. No consumers; domain too large for this satellite.
- `odoo-mcp` — salvage code only for a fresh Atlas MCP build. Not adopted as-is.
- `odoo-state-manager` — deprecate or greatly reduce in favour of `godoo-stateman`. Has one internal consumer. Not adopted into `godoo-ts`.
- `odoo-test-harness` — already dead; absorbed into `odoo-testcontainers`. Do not carry.

---

## 3. godoo-adoption protocol — how this satellite adopts

`godoo-ts` runs under the initiative's **`godoo-adoption` branch protocol** for code-transfer adoptions. The protocol moves code cleanly from a source repo into a satellite repo with **no period of dual-maintenance**: a shared `godoo-adoption` branch is opened on both sides, and as each package is adopted by the satellite it is removed from the source repo, so the code lives in exactly one place at any moment.

`godoo-ts` is the **destination / adopt side**: it receives the core-3 packages, renames them, runs tests, and publishes them under `@godoo/`. `odoo-toolbox` is the **source / shed side**: it tags a clean baseline, removes each package as `godoo-ts` confirms it stable, and finally merges a deprecation `README.md` to `main`. Adopt packages in the dependency-driven order stated in section 2.

The full protocol — branch convention, the step-by-step source and destination procedures, and the which-side reference table — is the canonical spine note at `../godoo-hq/.planning/notes/godoo-adoption-protocol.md`. It is not restated here; read it when executing the adoption.

---

## 4. Report-back

On adoption completion, `godoo-ts` files a **single terminal report** to the spine: one `## YYYY-MM-DD — <title>` entry appended (newest-first) to `dev-log.md` at the `godoo-hq` spine repo root, naming the satellite, the completion date, and the verified outcomes. There is no periodic status update — the satellite reports only when *all* success criteria below are met. The spine then verifies by querying this sibling repo directly (no copied state is accepted).

The mechanism — format, location, trigger, verification method, and the v1.1 close gate — is defined in the spine note at `../godoo-hq/.planning/notes/report-back-mechanism.md`. Read it when ready to report.

**At completion, godoo-ts reports these six outcomes:**

- Core 3 renamed and published under `@godoo/` npm scope (`@godoo/client`, `@godoo/introspection`, `@godoo/testcontainers`)
- `odoo-skills` ejected from the repo
- `odoo-cli` deprecated
- `odoo-mcp` handed off or deprecated
- `odoo-state-manager` handed off or deprecated (in favour of `godoo-stateman`)
- `odoo-toolbox` source repo retired: deprecation `README.md` written and merged to `main` on `odoo-toolbox`, pointing to `godoo-ts` (and other destination repos) as the new homes for each package

---

## 5. Org bootstrap

Create the satellite repo under the `godoo-dev` org once the local repo is ready. Visibility is the satellite's decision.

```bash
gh repo create godoo-dev/godoo-ts --private
```

Note: `--public` is also valid depending on the satellite's license decision. The core-3 libraries are expected to be published under LGPL-3.0, which makes public visibility natural. The spine does not make this call — the satellite decides at charter time.

Once the remote is created, wire the local repo and push:

```bash
git remote add origin https://github.com/godoo-dev/godoo-ts.git
git push -u origin main
```

**CLAUDE.md wiring.** When `godoo-ts` runs `/gsd:new-project`, the generated `CLAUDE.md` must `@`-import the shared umbrella context so the repo stays umbrella-aware. Add this line to the generated `CLAUDE.md`:

```
@../godoo-hq/UMBRELLA_CLAUDE.md
```

The umbrella file is imported (never copied) via this relative sibling path, so a freshly-cloned `godoo-ts` immediately picks up the initiative context.

---

## 6. Open questions / discretion areas

The following are left for the satellite's own `/gsd:new-project` pass:

- **GitHub visibility** — private vs. public. The core-3 libraries are expected to carry LGPL-3.0 (per the locked topology-naming decisions), making public the natural choice. Confirm at charter time.
- **`odoo-state-manager` disposition** — deprecate or retain as a reduced shim depends on the consuming project's migration timeline. The satellite owns this decision; the spine records the outcome in `dev-log.md` when the report-back is filed.
- **Toolchain choices** — pnpm vs npm, tsup build configuration, test runner (vitest vs jest), CI provider. These are satellite implementation decisions not constrained by this brief.
- **Resolving the `@godoo/client` ↔ `@godoo/testcontainers` coupling** — `testcontainers` peer-depends on `client`, AND `client`'s integration tests depend on `testcontainers`, so the two are *not* freely orderable: they cannot be cleanly validated in isolation. Satellite planning picks one of the two resolutions stated in §2 — adopt the pair as a coupled first wave, or adopt `client` first with its integration tests temporarily skipped and re-enable them once `testcontainers` lands. `@godoo/introspection` has no such coupling and is adopted after the client is stable.
- **`odoo-mcp` handoff target** — the Atlas MCP build is a future Layer-1 project; what code, if any, to salvage from `odoo-mcp` into it is an Atlas MCP charter decision, not `godoo-ts`'s.
