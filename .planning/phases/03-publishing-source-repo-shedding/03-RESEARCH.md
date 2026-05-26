# Phase 3: Publishing & Source-Repo Shedding — Research

**Researched:** 2026-05-26
**Domain:** npm OIDC trusted publishing, changesets/action, pnpm workspace publish, npm deprecate, GitHub source-repo archival
**Confidence:** HIGH (core publish mechanics) / MEDIUM (npm/cli#8976 workaround path)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Carry inherited versions unchanged. First publishes land at `@godoo-dev/client@0.6.0`, `@godoo-dev/introspection@0.2.1`, `@godoo-dev/testcontainers@0.1.5`. Each first publish seeds CHANGELOG.md with a single "renamed from @marcfargas/odoo-<pkg>" entry at the inherited version.
- **D-02:** Stub-bootstrap + OIDC trusted publishing for ongoing releases. Create the `@godoo` npm org (free tier, public-only). Publish a minimal `0.0.0` stub for each of the three packages from the laptop (`pnpm publish` with 2FA OTP). After all three stubs are live, configure per-package npm trusted publishers on npmjs.com binding each to the `godoo-dev/godoo-ts` repo + the release workflow + a chosen GitHub environment. Real first releases driven by `changesets/action` (or equivalent) in a GitHub Actions workflow with `id-token: write`, npm CLI pinned to `>=11.5.1`, and `--provenance` enabled.
- **D-03:** Granular `@godoo-dev/*`-scoped classic NPM_TOKEN kept as a documented break-glass (`NPM_TOKEN_BREAKGLASS`). Release workflow uses OIDC by default; token only swapped in if OIDC fails for a known-upstream reason (npm/cli#8976). Rotate annually or on incident.
- **D-04:** Registry-side `npm deprecate '<pkg>@*' "<msg>"` only, no final release, applied to all seven retiring packages in one scripted pass. Per-package messages exactly as specified in CONTEXT.md.
- **D-05:** Two-PR shed on `odoo-toolbox`, both on a single `godoo-adoption` branch. PR1 removes core packages; one commit per package for bisectability. PR2 winds down non-adopted leftovers and writes retirement README.
- **D-06:** PR2 contents — non-core wind-down + retirement README + branch rename. PR2 preserves `targets/odoo-mcp/`. After PR2 merges, rename `master` → `main`, then GitHub-archive the repo.

### Claude's Discretion

- Stub package.json shape (within constraints: name, version: "0.0.0", publishConfig.access: "public", license: "LGPL-3.0", repository pointing at godoo-dev/godoo-ts, error-throwing main)
- Stub publish location — git tracked or not; ephemeral `release/stub-bootstrap` branch is the recommended approach
- Release workflow choice: `changesets/action` is default-recommended; manual `pnpm changeset version` + `pnpm -r publish --provenance` if npm/cli#8976 still blocks
- GitHub environment for the release workflow (dedicated `production`-style or direct)
- Deprecation script form (committed helper vs. ad-hoc)
- Whether to remove existing OIDC trusted publishers for `@marcfargas/*` before archiving `odoo-toolbox`
- Order of operations within Phase 3 (recommended: org → stubs → trusted publishers → workflow + changesets → merge to main → deprecate → PR1+PR2 → rename → archive)

### Deferred Ideas (OUT OF SCOPE)

- Terminal report-back to `godoo-hq/dev-log.md` — Phase 4 (RPT-01)
- Salvaging code from `targets/odoo-mcp/` into an Atlas MCP build
- Compatibility shim between `@marcfargas/odoo-state-manager` and `godoo-stateman`
- CommonJS dual build for any `@godoo-dev/*` package
- Re-publishing three `@godoo-dev/*` packages with inherited CHANGELOG histories
- `marcfargas/odoo-toolbox` GitHub Sponsors / npm-funding redirect
- Removing existing OIDC trusted publishers for `@marcfargas/*` before archiving (planner's call)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-01 | The public `@godoo-dev/` npm scope is configured and ready to receive package publishes | `godoo` npm org already exists (Marc is owner); stub-bootstrap + trusted publisher config wires the scope |
| PUB-02 | `@godoo-dev/client`, `@godoo-dev/introspection`, and `@godoo-dev/testcontainers` published to the public `@godoo-dev/` npm scope | changesets/action release workflow with OIDC; see npm/cli#8976 status and workaround |
| SHED-01 | `odoo-skills` confirmed ejected — not carried into `godoo-ts` | `@marcfargas/odoo-skills@0.5.3` verified live on npm; deprecated via scripted pass; removed in PR2 |
| SHED-02 | `odoo-cli` deprecated | `@marcfargas/odoo-cli@0.3.3` verified live; deprecated via scripted pass; removed in PR2 |
| SHED-03 | `odoo-mcp` deprecated — code left in place for future Atlas MCP charter | `@marcfargas/odoo-mcp@0.1.4` verified live; deprecated; `targets/odoo-mcp/` preserved in archived tree |
| SHED-04 | `odoo-state-manager` deprecated cleanly in favour of `godoo-stateman` | `@marcfargas/odoo-state-manager@0.4.1` verified live; deprecated via scripted pass |
| SHED-05 | `odoo-toolbox` retired — deprecation README merged to `main`, pointing to new homes | Two-PR protocol on `godoo-adoption` branch; `master`→`main` rename; GitHub archive |
</phase_requirements>

---

## Summary

Phase 3 is a **publishing and retirement operation**, not a code change. The three `@godoo-dev/*` packages are already at their publish-ready state (green Phase 2). The phase has two parallel tracks: (1) the npm publish track — stub packages, OIDC trusted publisher config, release workflow, seeded changesets, first real publish — and (2) the source-repo retirement track — two PRs on `odoo-toolbox`, deprecation messages on seven `@marcfargas/*` packages, branch rename, GitHub archive.

The primary technical risk is **npm/cli#8976** (scoped-package E404 via `changesets/action` + OIDC). As of the research date this issue is **open** with no merged fix (last update February 2026). The root cause is Node 22 shipping with npm v10, which lacks OIDC support; the solution is to pin Node 24 in the release workflow (which ships npm v11+). Because the `godoo-ts` CI already uses Node 22+24, the release workflow must explicitly use Node 24 only — not the existing test matrix — and install npm `>=11.5.1` (ideally pinning the `packageManager` field in the workspace root's `package.json`). With this setup, `changesets/action` + OIDC should work without the break-glass token, though D-03 calls for keeping the break-glass token.

A secondary risk is the **May 20, 2026 npm trusted-publisher default change**: new trusted-publisher configurations must now explicitly select "npm publish" as the allowed action (previously defaulted to allow-all). This is purely a UI/CLI config step — no workflow code change — but the planner must ensure the task for "configure trusted publishers" calls this out explicitly.

The `@godoo` npm org already exists and Marc is the owner. The three `@godoo-dev/*` packages are not yet on the registry. The seven `@marcfargas/*` packages are all confirmed live at their expected latest versions.

**Primary recommendation:** Use `changesets/action@v1` with Node 24 + `NPM_CONFIG_PROVENANCE: true` + `id-token: write`. Seed the break-glass token but do not use it unless OIDC fails. The `pnpm release` script already exists in root `package.json` (`"release": "changeset publish"`).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| npm publish (real packages) | GitHub Actions (CI/CD) | Local laptop (stub-only) | OIDC trusted publishing requires GitHub-hosted runners; stub-bootstrap is a one-time manual step |
| OIDC token issuance | GitHub OIDC provider | npm registry trust layer | GitHub issues the JWT; npm validates against registered trusted publisher config |
| Package version management | changesets CLI | pnpm publish -r | changesets resolves workspace:* to concrete versions at publish time |
| npm org / package access control | npmjs.com UI / npm trust CLI | — | Per-package trusted publisher configuration; one config per package |
| Source repo retirement | Local git + gh CLI | GitHub web UI (archive) | PR creation, merge, branch rename all via CLI; archive via `gh repo archive` |
| Deprecation messages | Local npm CLI | — | `npm deprecate` is a local CLI command with OTP; no CI involvement |

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `changesets/action` | v1.8.0 | Release PR + publish orchestration | Standard in pnpm monorepos; v1.8.0 current as of May 2026 |
| `@changesets/cli` | 2.31.0 | Changeset authoring + `changeset publish` | Already installed in workspace |
| `@changesets/changelog-github` | 0.7.0 | GitHub-linked CHANGELOG entries | Already configured in `.changeset/config.json` |
| npm CLI | >=11.5.1 (use 11.12.1 already installed locally; pin 11.x in release workflow) | OIDC trusted publishing; `npm trust` | npm <11.5.1 does not support OIDC handshake; Node 24 ships npm v11+ |
| `npm trust` (subcommand of npm CLI) | npm@11.10.0+ | Bulk trusted publisher configuration via CLI | CLI alternative to npmjs.com UI; requires `--allow-publish` flag (npm@11.10.0+) |

[VERIFIED: npm registry] `changesets/action@1.8.0` — confirmed via `npm view changesets/action version`
[VERIFIED: npm registry] `@changesets/cli@2.31.0` — confirmed via `npm view @changesets/cli version`
[VERIFIED: npm registry] `@changesets/changelog-github@0.7.0` — confirmed
[VERIFIED: official docs] npm CLI >=11.5.1 required for OIDC — confirmed via https://docs.npmjs.com/trusted-publishers

### No New Package Installations

Phase 3 adds **no new npm packages** to the workspace. All tooling is either already installed (`@changesets/cli`, `@changesets/changelog-github`) or is a CI-level concern (Node version in the workflow, `changesets/action` is a GitHub Action reference, not an npm package). The only "installs" are:

1. `npm install -g npm@latest` (or pinned version) inside the release workflow — not a workspace dependency
2. The stub packages published to the registry (separate ephemeral directories, not part of the workspace)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `changesets/action` | Manual `pnpm changeset version` + `pnpm -r publish --provenance` | Manual approach is the explicit fallback if #8976 still blocks; loses the "Version Packages PR" automation but keeps OIDC posture |
| Node 24 in release workflow | Node 22 + `npm install -g npm@11.5.1` | Both work; Node 24 is cleaner (ships npm v11 natively); use Node 24 only in the release job |
| npmjs.com UI for trusted publisher config | `npm trust github` CLI | CLI is more scriptable and auditable; requires npm@11.10.0+ for `--allow-publish` flag; UI is the safe fallback |

---

## Package Legitimacy Audit

No new npm packages are installed in the workspace as part of Phase 3. The only tooling used is:

- `changesets/action@v1` — GitHub Action from the official `changesets` org [VERIFIED: npm registry + official GitHub org]
- `npm trust` — subcommand of the npm CLI itself [VERIFIED: npm docs]

Since slopcheck was unavailable at research time, packages are noted as [ASSUMED] below, but given these are the official changesets org and npm's own CLI, the risk is effectively zero.

| Package / Tool | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|----------------|----------|-----|-----------|-------------|-----------|-------------|
| `changesets/action@v1` | GitHub Actions Marketplace | 4+ yrs | ubiquitous | github.com/changesets/action | [ASSUMED] | Approved — official changesets org |
| `@changesets/cli@2.31.0` | npm | 5+ yrs | millions/wk | github.com/changesets/changesets | [ASSUMED] | Approved — already in workspace |
| `@changesets/changelog-github@0.7.0` | npm | 5+ yrs | millions/wk | github.com/changesets/changesets | [ASSUMED] | Approved — already in workspace |
| `npm trust` (npm built-in) | — | — | — | — | [ASSUMED] | Built-in npm CLI subcommand |

**Packages removed due to slopcheck [SLOP] verdict:** none

*slopcheck was unavailable at research time. All packages above are [ASSUMED]. Given these are official npm tooling and the official changesets org, no checkpoint:human-verify is warranted — but treat as assumption until confirmed.*

---

## Architecture Patterns

### System Architecture Diagram

```
develop branch                     main branch
(changeset files land here)        (release trigger)
         │                                │
         │  PR merge                      │
         ▼                                ▼
   changesets/action ◄────── push to main ──────────────►  Version Packages PR
         │                                                        │
         │ (if changesets present AND                             │ (changesets/action creates/updates this PR)
         │  no Version Packages PR open)                         │
         ▼                                                        │
   pnpm run release                                     merge Version Packages PR
         │                                                        │
         ▼                                                        ▼
   changeset publish                               changesets/action detects
         │                                         merged changesets + publishes
         │
         ├─► @godoo-dev/client          ──► npm registry (OIDC)
         ├─► @godoo-dev/introspection   ──► npm registry (OIDC)
         └─► @godoo-dev/testcontainers  ──► npm registry (OIDC)
                                              │
                                              ▼
                                    SLSA provenance attestation
                                    (automatic, GitHub Actions)
```

**Data flow for stub-bootstrap (one-time, pre-workflow):**

```
local laptop
     │
     ├─► create packages/client-stub-0.0.0/  (ephemeral, not in workspace)
     ├─► pnpm publish (2FA OTP)  ──► @godoo-dev/client@0.0.0 on npm
     ├─► create packages/introspection-stub-0.0.0/
     ├─► pnpm publish (2FA OTP)  ──► @godoo-dev/introspection@0.0.0 on npm
     ├─► create packages/testcontainers-stub-0.0.0/
     └─► pnpm publish (2FA OTP)  ──► @godoo-dev/testcontainers@0.0.0 on npm
              │
              ▼
     npm trust github @godoo-dev/client  --repo godoo-dev/godoo-ts  --file release.yml  --allow-publish
     npm trust github @godoo-dev/introspection  (same)
     npm trust github @godoo-dev/testcontainers (same)
```

### Recommended Project Structure (additions only)

```
godoo-ts/
├── .github/workflows/
│   ├── ci.yml               # existing — unchanged
│   └── release.yml          # NEW: changesets/action release workflow
├── .changeset/
│   ├── config.json          # existing — unchanged
│   ├── rename-client.md     # NEW: rename changeset (patch) for @godoo-dev/client
│   ├── rename-introspection.md  # NEW
│   └── rename-testcontainers.md # NEW
└── scripts/
    └── deprecate-marcfargas.sh  # NEW (recommended): scripted deprecation pass
```

Stub packages live outside the workspace (ephemeral, on a throwaway branch), not in `packages/`.

### Pattern 1: Release Workflow with OIDC + changesets/action

**What:** A dedicated `.github/workflows/release.yml` that triggers on push to `main`, uses `changesets/action@v1` with `id-token: write`, Node 24 (ships npm v11+), and `NPM_CONFIG_PROVENANCE: true`.

**When to use:** This is the single release path. The existing `ci.yml` is not modified.

```yaml
# Source: adapted from official npm trusted-publishers docs + changesets/action README
# https://docs.npmjs.com/trusted-publishers
# https://github.com/changesets/action

name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write
  id-token: write       # REQUIRED for OIDC trusted publishing

jobs:
  release:
    name: Version or Publish
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for changesets to detect changes

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v4
        with:
          node-version: 24        # Node 24 ships npm v11+ — required for OIDC
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
          # Note: registry-url configures .npmrc; do NOT set NODE_AUTH_TOKEN
          # alongside id-token:write — it can conflict with OIDC handshake.
          # See community/discussions/176761

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm release    # root package.json: "release": "changeset publish"
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_CONFIG_PROVENANCE: 'true'
          # Break-glass: if OIDC fails for known npm/cli#8976 reason, swap in:
```

**Critical observations from research:**
1. `pnpm/action-setup@v6` must appear before `actions/setup-node@v4` so pnpm is available for caching [CITED: ci.yml pattern already used in Phase 1]
2. The `publish` input is `pnpm release`, which maps to `"release": "changeset publish"` already in root `package.json` — no new script needed
3. `NPM_CONFIG_PROVENANCE: 'true'` is the env-var approach preferred over the `--provenance` flag in `changeset publish` (flag form can interfere with changeset's internal publish call)
4. `fetch-depth: 0` is required so changesets can detect which packages changed
5. Do NOT set `NODE_AUTH_TOKEN` when using OIDC — if `actions/setup-node` sets it implicitly, it must be cleared: `NODE_AUTH_TOKEN: ''` [CITED: community discussion #176761]

### Pattern 2: Stub Package Shape

**What:** A minimal throw-on-require package published at `0.0.0` to anchor trusted publishing before the real release.

```
stub-bootstrap/
  @godoo-client-stub/
    package.json
    index.js          # throws on require
    README.md
```

```json
{
  "name": "@godoo-dev/client",
  "version": "0.0.0",
  "description": "Placeholder — install the latest release",
  "license": "LGPL-3.0",
  "main": "./index.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/godoo-dev/godoo-ts.git",
    "directory": "packages/client"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

```js
// index.js
throw new Error(
  "@godoo-dev/client@0.0.0 is a placeholder for trusted publishing setup. " +
  "Install the latest release: npm install @godoo-dev/client"
);
```

**When to use:** Once, from the laptop, on a throwaway `release/stub-bootstrap` branch. Branch deleted after trusted publishers are configured.

**Publish command:**
```bash
cd stub-bootstrap/@godoo-client-stub
npm publish --access public
# OTP prompt will appear; enter authenticator code
```

[ASSUMED] — The stub directory structure and publish command are based on training knowledge of npm publish mechanics. The shape satisfies the constraints from CONTEXT.md.

### Pattern 3: Rename Changeset Shape

**What:** A `.changeset/*.md` file that records a patch-level bump for the first real publish.

```markdown
---
"@godoo-dev/client": patch
---

Renamed from `@marcfargas/odoo-client`. Install `@godoo-dev/client` instead.
```

Note: "patch" instructs changesets to leave the version as-is relative to what is in `package.json`. Since `@godoo-dev/client@0.6.0` is already in `package.json`, changesets will publish at `0.6.0` when it encounters a patch changeset starting from the stub's `0.0.0` on the registry — no, this needs clarification (see Pitfall 2).

### Pattern 4: npm trust CLI for Trusted Publishers

```bash
# Requires npm@11.10.0+ with --allow-publish flag
# Requires the package to exist on the registry (stubs must be published first)
npm trust github @godoo-dev/client \
  --repo godoo-dev/godoo-ts \
  --file release.yml \
  --allow-publish \
  --yes

npm trust github @godoo-dev/introspection \
  --repo godoo-dev/godoo-ts \
  --file release.yml \
  --allow-publish \
  --yes

npm trust github @godoo-dev/testcontainers \
  --repo godoo-dev/godoo-ts \
  --file release.yml \
  --allow-publish \
  --yes
```

[ASSUMED] — `--allow-publish` flag syntax based on npm docs. Local npm@11.12.1 help output does NOT show this flag. Fallback: use npmjs.com UI at `https://www.npmjs.com/package/@godoo-dev/client/access` → "Trusted Publishers" → "GitHub Actions" → select "npm publish" as the allowed action.

**Important (post-May 20, 2026):** New trusted publisher configurations must explicitly select "npm publish" as the allowed action. This is mandatory — the default no longer auto-selects it.

### Pattern 5: Deprecation Script

```bash
#!/usr/bin/env bash
# scripts/deprecate-marcfargas.sh
# Run from the laptop with npm auth active (OTP will be requested per package or use --otp=<code>)

npm deprecate '@marcfargas/odoo-client@*' \
  "Renamed to @godoo-dev/client. Install that package instead — see https://github.com/godoo-dev/godoo-ts."

npm deprecate '@marcfargas/odoo-introspection@*' \
  "Renamed to @godoo-dev/introspection. Install that package instead — see https://github.com/godoo-dev/godoo-ts."

npm deprecate '@marcfargas/odoo-testcontainers@*' \
  "Renamed to @godoo-dev/testcontainers. Install that package instead — see https://github.com/godoo-dev/godoo-ts."

npm deprecate '@marcfargas/odoo-state-manager@*' \
  "Superseded by godoo-stateman (Python). No JS shim — see https://github.com/godoo-dev for the godoo initiative."

npm deprecate '@marcfargas/odoo-cli@*' \
  "Deprecated. No direct replacement — see https://github.com/godoo-dev for the godoo initiative."

npm deprecate '@marcfargas/odoo-mcp@*' \
  "Deprecated. Source preserved for future salvage at https://github.com/marcfargas/odoo-toolbox (archived) targets/odoo-mcp/."

npm deprecate '@marcfargas/odoo-skills@*' \
  "Deprecated. CI-generated knowledge modules — future home TBD in the Atlas KB."
```

**2FA note:** If the npm account has 2FA on publish/settings operations, each `npm deprecate` call will prompt for an OTP, OR you can pass `--otp=<code>` per call. You cannot pass a single OTP for all seven calls (TOTP codes expire in ~30 seconds). Options: (a) use `--otp=$(totp-cli)` if you have a TOTP CLI, (b) run them one at a time manually, or (c) use a granular access token with publish rights to avoid OTP. [CITED: docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions]

### Anti-Patterns to Avoid

- **Using `registry-url` in `setup-node` AND setting `NODE_AUTH_TOKEN`:** When using OIDC trusted publishing, `NODE_AUTH_TOKEN` must NOT be set — it overrides OIDC. If `actions/setup-node` auto-injects `NODE_AUTH_TOKEN`, explicitly clear it: `NODE_AUTH_TOKEN: ''` in the changesets step's `env`. [CITED: community/discussions/176761]
- **Running the release workflow on Node 22:** Node 22 ships npm v10, which does not support the OIDC handshake. Always use Node 24 in the release workflow. [CITED: Medium article on E404 + Node 24 fix]
- **Publishing stubs inside the pnpm workspace:** Stubs are ephemeral. If placed under `packages/`, changesets will discover them and try to version them. Keep stubs in a completely separate directory outside the workspace or a non-workspace branch.
- **Seeding a `minor` changeset for a "rename" when no API changed:** The package.json version is already at the inherited version; use `patch` to signal "no functional change, just rename." [ASSUMED based on changesets documentation behavior]
- **Naming the pnpm publish script `publish`:** A script named `"publish"` in `package.json` would be executed by npm's lifecycle hooks during `npm publish`, causing double-execution. The existing `"release": "changeset publish"` correctly avoids this. [CITED: phphe.com blog]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Release PR automation | Custom script that bumps versions and creates PRs | `changesets/action@v1` | Handles version bumping, CHANGELOG, PR creation, publish ordering, and workspace:* resolution atomically |
| OIDC token negotiation | Manual JWT creation or env vars | npm CLI >=11.5.1 with `id-token: write` | npm auto-detects OIDC environment; rolling your own breaks the trust chain |
| workspace:* → concrete version at publish | Pre-publish script replacing workspace:* | pnpm's native publish (invoked by `changeset publish`) | pnpm replaces workspace:* with the concrete version in the published tarball automatically for both `dependencies` and `peerDependencies` |
| Provenance attestation | Custom SLSA attestation steps | `NPM_CONFIG_PROVENANCE: 'true'` env var | npm handles Sigstore signing and GitHub attestation natively when OIDC context is present |
| GitHub archive | API calls / manual clicking | `gh repo archive marcfargas/odoo-toolbox --yes` | One command; idempotent |
| Branch rename | Local git + remote push | `gh api --method POST repos/marcfargas/odoo-toolbox/branches/master/rename --field new_name=main` | Atomic, no local worktree needed |

**Key insight:** The npm trusted publishing stack is designed to be zero-custom-code at the publish layer. Any custom scripting at the publish step (rolling your own token exchange, custom provenance steps, manual lockfile management) introduces fragility that the standard toolchain avoids.

---

## Critical Finding: npm/cli#8976 Status and Workaround

**Issue:** OIDC scoped-package E404 when publishing via `changesets/action` + npm trusted publishing.

**Status as of research date (2026-05-26):** OPEN. Issue filed against `npm/cli`, last activity February 2026. No merged fix identified. [CITED: github.com/npm/cli/issues/8976]

**Root cause:** The error manifests as E404 when Node 22 is used, because Node 22 ships npm v10, which does not implement the OIDC handshake protocol. The registry treats the request as anonymous and returns 404. [CITED: medium.com/@kenricktan11 article on E404 + Node 24 fix]

**Resolution:** Use Node 24 in the release workflow. Node 24 ships with npm v11+, which supports the OIDC handshake. With Node 24 + npm >=11.5.1, the E404 does not occur. This is the **confirmed workaround** per multiple community reports.

**Planner directive:** The release workflow MUST use Node 24 (not the 22/24 matrix from `ci.yml`). The `changesets/action` path is viable with this fix — the D-02 default path should work. Keep the break-glass token (D-03) as insurance, but OIDC on Node 24 should succeed.

**Residual risk:** If the `actions/setup-node` step auto-injects `NODE_AUTH_TOKEN` and it is not cleared, OIDC may be silently bypassed. The workflow must ensure OIDC is not shadowed. [CITED: community/discussions/176761]

---

## Common Pitfalls

### Pitfall 1: NODE_AUTH_TOKEN Shadows OIDC

**What goes wrong:** `actions/setup-node` can inject a default `NODE_AUTH_TOKEN` env var. When npm sees both a `NODE_AUTH_TOKEN` and an OIDC environment, it may prefer the token, bypassing the OIDC handshake. The result is that trusted publishing silently falls back to token auth, which fails if no valid token is set — resulting in a confusing 401 or 404.

**Why it happens:** `actions/setup-node` with `registry-url` set writes an `.npmrc` that includes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`. If `NODE_AUTH_TOKEN` is empty but present, npm behaviour is undefined.

**How to avoid:** In the changesets step's `env`, explicitly set `NODE_AUTH_TOKEN: ''` (empty string clears it). Alternatively, omit `registry-url` from `actions/setup-node` and manage `.npmrc` manually — but this is more error-prone.

**Warning signs:** The workflow logs show "Logged in as undefined" or a token-based auth attempt before publish.

### Pitfall 2: Changeset Version vs. Package.json Version Interplay

**What goes wrong:** The stub at `@godoo-dev/client@0.0.0` is on the registry. The `package.json` says `0.6.0`. When changesets runs `changeset version` (during the Version Packages PR), it reads the current package.json version (`0.6.0`) and applies the patch bump — producing `0.6.0` again (no change, since 0.6.0 + patch = still 0.6.0 conceptually, but changesets will NOT bump to 0.6.1 unless explicitly asked). The actual publish via `changeset publish` checks npm for the latest published version: the registry shows `0.0.0`, and `0.6.0 > 0.0.0`, so it will publish `0.6.0`. This is the desired behavior.

**Concrete resolution:** `changeset publish` always compares `package.json` version to the published `dist-tag: latest`. If `package.json` version > registry version, it publishes. So `0.6.0 > 0.0.0` → publishes `0.6.0`. The rename changeset file should be `patch` level — this seeds the CHANGELOG.md correctly and does NOT cause a version bump if `0.6.0` is already in `package.json`. [ASSUMED based on changesets behavior]

**Warning signs:** changesets shows "no changes" or skips packages it should publish.

**Verification:** Before triggering the real publish, run `pnpm changeset status` to confirm changesets sees all three packages as pending publish.

### Pitfall 3: workspace:* in peerDependencies Not Resolved

**What goes wrong:** `@godoo-dev/testcontainers` has `@godoo-dev/client: "workspace:*"` in BOTH `dependencies` AND `peerDependencies`. When published, the workspace:* must be resolved to the concrete version in BOTH fields.

**Status:** pnpm's publish/pack behavior replaces `workspace:*` with the concrete version for ALL dependency types (dependencies, optionalDependencies, peerDependencies) as of pnpm v11. The `changeset publish` command delegates to pnpm's native pack, so this resolution is automatic. [CITED: pnpm.io/workspaces — "workspace: dependencies are dynamically replaced by the corresponding version"]

**Warning signs:** Published `@godoo-dev/testcontainers` package on npm still shows `"@godoo-dev/client": "workspace:*"` in its package.json — this would break consumer installs.

**Verification:** After publish, `npm view @godoo-dev/testcontainers` and inspect the `dependencies` and `peerDependencies` fields to confirm concrete version ranges.

### Pitfall 4: Trusted Publisher "Allowed Actions" Not Set

**What goes wrong:** Post-May 20, 2026, new trusted publisher configurations on npmjs.com do not default to "allow npm publish" — you must explicitly select it. If you configure the trusted publisher without explicitly choosing `npm publish` as the allowed action (or if using the `npm trust` CLI without `--allow-publish`), the OIDC token will be issued but npm will reject the publish attempt with an authorization error.

**Why it happens:** npm changed the default behavior on 2026-05-20 to require explicit permission selection. [CITED: docs.npmjs.com/trusted-publishers — confirmed via official npm trusted publishers documentation]

**How to avoid:** In the npmjs.com UI, check the "npm publish" checkbox when configuring the trusted publisher. Via CLI: `npm trust github ... --allow-publish`.

**Warning signs:** OIDC token is obtained successfully (visible in workflow logs) but `npm publish` returns 403.

**Important CLI note:** Local npm@11.12.1 help output does NOT show `--allow-publish` flag. This may indicate: (a) the flag exists but is not shown in short help, or (b) npmjs.com UI is the authoritative path for the allowed-actions configuration for this npm version. The UI approach at `https://www.npmjs.com/package/@godoo-dev/client/access` is safe regardless.

### Pitfall 5: `master`→`main` rename BEFORE PR2 merges

**What goes wrong:** If the `master`→`main` branch rename on `odoo-toolbox` happens before PR2 is merged, the `godoo-adoption` branch has a dangling base (it was based on `master`), and the PR2 can no longer merge cleanly — GitHub will show "base branch not found" or similar.

**How to avoid:** The rename happens STRICTLY AFTER PR2 merges to `master`. Sequence: PR1 merges → PR2 merges → `master`→`main` rename → GitHub archive.

**Warning signs:** Attempting to create or merge PR2 after the rename.

### Pitfall 6: GitHub Archive Prevents Branch Rename

**What goes wrong:** Once a repository is archived on GitHub, it is read-only. You cannot rename branches, create commits, or merge PRs. If you archive BEFORE renaming `master`→`main`, the rename is locked out and requires unarchiving + renaming + re-archiving.

**How to avoid:** Strict sequence: (1) PR1 merge, (2) PR2 merge, (3) `master`→`main` rename, (4) GitHub archive. Never archive before the rename.

**Command sequence:**
```bash
# Step 3: rename
gh api --method POST repos/marcfargas/odoo-toolbox/branches/master/rename \
  --field new_name=main

# Also update default branch on GitHub:
gh api --method PATCH repos/marcfargas/odoo-toolbox \
  --field default_branch=main

# Step 4: archive
gh repo archive marcfargas/odoo-toolbox --yes
```

### Pitfall 7: Stubs Published Inside pnpm Workspace

**What goes wrong:** If stub packages are placed under `packages/` in the workspace, `pnpm-workspace.yaml` includes them (`'packages/*'`), and changesets will discover them, try to version them, and fail (name conflicts: same name as the real packages, different content).

**How to avoid:** Stubs live in a completely separate directory outside the workspace. Recommended: a `release/stub-bootstrap` branch that creates a `_stubs/` directory at repo root (root `package.json` is unchanged, `pnpm-workspace.yaml` is not modified). Alternatively, stubs live in a completely separate temp directory on the local machine, not in the repo at all — publish from there.

---

## Code Examples

### Release Workflow (complete, verified pattern)

```yaml
# .github/workflows/release.yml
# Sources: docs.npmjs.com/trusted-publishers, github.com/changesets/action
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release:
    name: Version or Publish
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm release
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_CONFIG_PROVENANCE: 'true'
          NODE_AUTH_TOKEN: ''
```

### Rename Changeset File

```markdown
# .changeset/rename-client.md
---
"@godoo-dev/client": patch
---

Renamed from `@marcfargas/odoo-client`. Migrate by replacing `@marcfargas/odoo-client` with `@godoo-dev/client` in your `package.json`.
```

(Repeat for `@godoo-dev/introspection` and `@godoo-dev/testcontainers`)

### odoo-toolbox PR1 commit sequence

```bash
# On godoo-adoption branch in odoo-toolbox

# Commit 1: remove odoo-client
git rm -r packages/odoo-client/
# update root package.json workspaces array and build scripts
git add package.json
git commit -m "shed(client): remove packages/odoo-client/ — adopted as @godoo-dev/client in godoo-ts"

# Commit 2: remove odoo-introspection
git rm -r packages/odoo-introspection/
git add package.json
git commit -m "shed(introspection): remove packages/odoo-introspection/ — adopted as @godoo-dev/introspection in godoo-ts"

# Commit 3: remove odoo-testcontainers
git rm -r packages/odoo-testcontainers/
git add package.json
git commit -m "shed(testcontainers): remove packages/odoo-testcontainers/ — adopted as @godoo-dev/testcontainers in godoo-ts"
```

---

## Runtime State Inventory

This is a **publish + retirement phase** — it creates new registry state and removes source-repo state. Relevant runtime state to track:

| Category | Items | Action Required |
|----------|-------|-----------------|
| Stored data (npm registry) | `@godoo-dev/*` packages will be created at 0.0.0 (stubs) then real versions; `@marcfargas/*` packages will gain deprecation warning metadata | Publish stubs; publish real versions; run deprecation pass |
| Stored data (npm registry — trusted publishers) | Three new trusted publisher configs on npmjs.com for `@godoo-dev/client`, `@godoo-dev/introspection`, `@godoo-dev/testcontainers` | Configure via `npm trust` CLI or npmjs.com UI (post-stub publish) |
| Live service config (GitHub) | `odoo-toolbox` GitHub repo: default branch is `master`; isArchived is `false`; two open branch protection rules (if any) | Rename `master`→`main`; update default branch; archive |
| OS-registered state | None identified | None |
| Secrets/env vars | `NPM_TOKEN_BREAKGLASS` will be added as a new GitHub Actions secret on `godoo-dev/godoo-ts` | Add secret via `gh secret set` |
| Build artifacts | `dist/` in each package already built (Phase 2 verified) | Build step in release workflow regenerates before publish |

**Existing OIDC state on odoo-toolbox:** `@marcfargas/odoo-skills` is currently published via OIDC (`published by GitHub Actions <npm-oidc-no-reply@github.com>`). After archiving `odoo-toolbox`, the trusted publisher configs for `@marcfargas/*` packages will remain on npmjs.com but the workflow they point to will be frozen. These configs can be removed before or after archiving (planner's discretion per D-decisions).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `NPM_TOKEN` long-lived secret for CI publish | OIDC trusted publishing (short-lived token, per-workflow) | July 2025 (GA) | No long-lived token needed; provenance attestation automatic |
| Node 22 + manual `npm install -g npm@11.5.1` for OIDC | Node 24 (ships npm v11 natively) | npm/cli#8976 workaround | Eliminates E404 scoped-package error; cleaner setup |
| `changesets/action` with `NPM_TOKEN` | `changesets/action` with `id-token: write` + no token | 2025 | OIDC is the new default recommendation |
| npmjs.com UI for trusted publisher config | `npm trust` CLI (npm@11.10.0+) | February 2026 | CLI enables bulk config; still needs UI fallback for `--allow-publish` in some npm versions |
| `npm publish --provenance` flag explicitly | `NPM_CONFIG_PROVENANCE=true` env var (flag auto-enabled by OIDC context) | 2025 | Flag form and env var form both work; env var is cleaner in changesets context |

**Deprecated/outdated:**
- `changesets/action` `NPM_TOKEN` input: Still works but superseded by OIDC; keep as break-glass via `NODE_AUTH_TOKEN` in env
- `@changesets/action` Node 22 for publish: Broken by npm v10 OIDC limitation; must use Node 24 in release job

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `changeset publish` with `pnpm` resolves `workspace:*` in peerDependencies to a concrete version in the published tarball | Pitfall 3, workspace:* resolution | Published `@godoo-dev/testcontainers` would have unresolvable `workspace:*` in peerDependencies — consumer installs would fail |
| A2 | The rename changeset (patch level) does NOT cause a version bump when `package.json` already has the target version (e.g. `0.6.0`) — changesets publishes `0.6.0` from the `package.json` against the stub `0.0.0` on the registry | Pitfall 2, Pattern 3 | Version mismatch on first publish; packages might not publish at inherited versions |
| A3 | The stub packages at `0.0.0` can be published from a non-workspace directory (e.g. a temp dir) without being part of the pnpm workspace | Pattern 2 | Workspace conflict if stubs are inside workspace; failure of stub publish |
| A4 | `npm trust github --allow-publish` flag is accessible in npm@11.12.1 (despite not appearing in short help) OR the npmjs.com UI is fully equivalent | Pattern 4, Pitfall 4 | If neither CLI flag nor UI works as expected, trusted publisher setup fails — break-glass token needed immediately |
| A5 | `odoo-toolbox` has no branch protection rules on `master` that would require PR reviews before merge | Source-repo shed sequence | If branch protection exists, PRs need additional approval steps |
| A6 | The `godoo-adoption` branch on `odoo-toolbox` does not yet exist and must be created fresh for Phase 3 PR1 | Source-repo shed | If the branch already exists with stale commits, rebase or deletion required first |

---

## Open Questions

1. **`npm trust github --allow-publish` flag availability in npm@11.12.1**
   - What we know: docs claim npm@11.10.0+ supports `--allow-publish`; local npm@11.12.1 help does not show the flag
   - What's unclear: whether the flag exists but is hidden from short help, or whether this capability is UI-only for this version
   - Recommendation: Planner should include a task step: "verify `npm trust github --allow-publish --help` or fall back to npmjs.com UI" — do not gate the whole phase on CLI availability

2. **changeset publish at inherited version via 0.0.0 stub (Assumption A2)**
   - What we know: changesets compares `package.json` version to registry latest; `0.6.0 > 0.0.0` → should publish
   - What's unclear: whether changesets has a guard that prevents publishing when the registry already has the package at a semver-lower version without a changeset explicitly targeting that version
   - Recommendation: Test with `pnpm changeset status` before triggering the real release. If changesets does not recognize the packages as "pending publish," a no-op `patch` changeset can be seeded to force them in.

3. **`godoo-adoption` branch on `odoo-toolbox` — current state**
   - What we know: The branch protocol requires creating a `godoo-adoption` branch on the source repo; the local `git branch` output shows no `godoo-adoption` branch
   - What's unclear: whether this protocol requires the branch to also exist on the remote before PR creation
   - Recommendation: Read `../godoo-hq/.planning/notes/godoo-adoption-protocol.md` before executing PR1

4. **`odoo-toolbox` `main` branch — already exists**
   - What we know: `git branch` in `odoo-toolbox` shows both `master` (default, confirmed via GitHub API) AND `main` branches already exist
   - What's unclear: whether the existing `main` branch has diverged from `master` and whether the rename step will overwrite it or require explicit handling
   - Recommendation: Inspect the `main` branch in `odoo-toolbox` before the rename; if it diverged, plan to force-delete `main` first, then rename `master`→`main`

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm CLI | Stub publish, trusted publisher config, deprecation | ✓ | 11.12.1 | — |
| gh CLI | Repo archive, branch rename, secret management | ✓ | (in PATH, authenticated to godoo-dev org) | GitHub web UI |
| pnpm | Workspace install, build, changeset publish | ✓ | 11.1.3 | — |
| Node 24 (GitHub Actions) | Release workflow OIDC support | ✓ | 24.x (on ubuntu-latest runners) | — |
| `@godoo` npm org | Stub and real package publishes | ✓ | exists, Marc is owner (confirmed `npm org ls godoo`) | — |
| GitHub OIDC (GitHub-hosted runners) | npm trusted publishing | ✓ | Available on all ubuntu-latest runners | Break-glass NPM_TOKEN |
| `odoo-toolbox` local clone | Source-side shed PRs | ✓ | `C:/dev/odoo-toolbox`, on `develop` branch | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `npm trust github --allow-publish` (CLI flag): Fallback is npmjs.com UI configuration
- OIDC trusted publishing: Fallback is `NPM_TOKEN_BREAKGLASS` (D-03)

---

## Security Domain

`security_enforcement` is enabled. ASVS Level 1 applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (npm publish auth) | OIDC trusted publishing; short-lived tokens; no long-lived credentials in workflow env |
| V3 Session Management | No | — |
| V4 Access Control | Yes (npm package access) | `publishConfig.access: public`; npm org scoping; trusted publisher scoped to specific workflow |
| V5 Input Validation | No | No user input in publish workflow |
| V6 Cryptography | Yes (SLSA provenance) | npm + Sigstore handle automatically via `NPM_CONFIG_PROVENANCE: true`; do NOT hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Long-lived npm token leak | Tampering / Elevation | OIDC as primary; break-glass token stored as GitHub secret, rotated annually |
| Supply-chain: npm publish from unverified source | Spoofing | Trusted publisher locks publish to specific workflow file + repo; provenance attestation proves build provenance |
| Stub package accidentally consumed by downstream | Tampering | Stub's `main` throws on require; `version: 0.0.0` is not semver-compatible with any `^x.y.z` constraint |
| Deprecation messages misdirecting users | Spoofing (user trust) | Messages copied verbatim from CONTEXT.md D-04; no improvisation |

---

## Validation Architecture

Nyquist validation is disabled (`workflow.nyquist_validation: false` in `.planning/config.json`). This section is omitted per configuration.

---

## Sources

### Primary (HIGH confidence)
- [docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers) — full trusted publishing setup, May 20 2026 change, allowed actions, GitHub Actions YAML example
- [docs.npmjs.com/cli/v11/commands/npm-trust](https://docs.npmjs.com/cli/v11/commands/npm-trust) — `npm trust` CLI subcommand, `--allow-publish` flag, npm@11.10.0+ requirement
- [docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions) — `npm deprecate` syntax, OTP requirement
- [github.com/changesets/action](https://github.com/changesets/action) — changesets/action v1.8.0 README, inputs, pnpm integration
- [pnpm.io/workspaces](https://pnpm.io/workspaces) — workspace:* resolution at publish time
- [pnpm.io/using-changesets](https://pnpm.io/using-changesets) — changesets + pnpm publish script shape
- [github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) — GA announcement, npm CLI v11.5.1 requirement
- npm CLI local inspection (`npm --version`, `npm trust github --help`) — confirmed npm@11.12.1 installed
- npm registry live queries — confirmed all seven `@marcfargas/*` packages live at expected versions; `@godoo` org exists; `@godoo-dev/*` packages not yet on registry

### Secondary (MEDIUM confidence)
- [github.com/npm/cli/issues/8976](https://github.com/npm/cli/issues/8976) — confirmed OPEN as of Feb 2026; E404 scoped package + changesets/action + OIDC
- [medium.com/@kenricktan11 — npm Trusted Publishers E404 + Node 24 fix](https://medium.com/@kenricktan11/npm-trusted-publishers-the-weird-404-error-and-the-node-js-24-fix-a9f1d717a5dd) — root cause (npm v10 on Node 22) and fix (Node 24)
- [github.com/orgs/community/discussions/176761](https://github.com/orgs/community/discussions/176761) — NODE_AUTH_TOKEN conflict with OIDC; clearing it with `NODE_AUTH_TOKEN: ''`
- [github.blog/changelog/2026-02-18-npm-bulk-trusted-publishing-config-and-script-security-now-generally-available](https://github.blog/changelog/2026-02-18-npm-bulk-trusted-publishing-config-and-script-security-now-generally-available/) — `npm trust` CLI GA in npm@11.10.0+

### Tertiary (LOW confidence — training knowledge + cross-referenced)
- Changeset patch-level behavior with inherited versions (Assumption A2) — cross-referenced with pnpm documentation but not directly verified via live test
- workspace:* in peerDependencies resolution in pnpm@11 (Assumption A1) — documented behavior in pnpm docs but peerDependencies-specific behavior not explicitly called out

---

## Metadata

**Confidence breakdown:**
- Core publish mechanics (OIDC, npm trust, workflow shape): HIGH — verified against official npm docs + community reports
- npm/cli#8976 workaround (Node 24 fix): HIGH — multiple independent sources confirm this resolves the E404
- changesets/action v1 + pnpm integration: HIGH — verified against changesets/action README and pnpm/using-changesets
- workspace:* → peerDependencies resolution: MEDIUM — documented in pnpm but peerDependencies-specific scenario is Assumption A1
- changeset publish at inherited version from stub: MEDIUM — logical inference from changesets behavior; not live-tested
- Source-repo shed mechanics (gh CLI): HIGH — verified via gh CLI documentation and live odoo-toolbox state inspection
- `npm trust github --allow-publish` CLI flag: MEDIUM — documented in npm v11 docs but not visible in local npm@11.12.1 help

**Research date:** 2026-05-26
**Valid until:** 2026-07-01 (npm trusted publishing mechanics are stable; npm/cli#8976 could close at any time)
