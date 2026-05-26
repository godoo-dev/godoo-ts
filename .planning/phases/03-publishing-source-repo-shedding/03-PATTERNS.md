# Phase 3: Publishing & Source-Repo Shedding - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 5 (in-repo new/modified files; source-repo shed files noted as out-of-repo)
**Analogs found:** 4 / 5 (1 file has no codebase analog — first shell script in this repo)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/release.yml` | config (CI/CD workflow) | event-driven (push trigger → publish) | `.github/workflows/ci.yml` | role-match (same workflow structure; different job purpose) |
| `.changeset/rename-client.md` | config (changeset marker) | batch (consumed by `changeset version` + `changeset publish`) | none yet — `.changeset/` is empty | no analog; use RESEARCH.md Pattern 3 |
| `.changeset/rename-introspection.md` | config (changeset marker) | batch | same as above | no analog |
| `.changeset/rename-testcontainers.md` | config (changeset marker) | batch | same as above | no analog |
| `scripts/deprecate-marcfargas.sh` | utility (one-shot script) | batch (sequential npm CLI calls) | no shell scripts exist in this repo | no analog; use RESEARCH.md Pattern 5 |
| Stub `package.json` (×3, ephemeral on `release/stub-bootstrap`) | config (stub package manifests) | n/a (never imported; throw-on-require) | `packages/client/package.json` | role-match (same manifest structure, minimal subset) |

**Out-of-this-repo files (no pattern extraction needed — executed against `C:\dev\odoo-toolbox`):**
- PR1: remove `packages/odoo-client/`, `packages/odoo-introspection/`, `packages/odoo-testcontainers/` + root `package.json` workspace edits
- PR2: remove non-adopted packages, rewrite `README.md` to deprecation pointer, trim root configs
- Branch rename `master` → `main` and GitHub archive

---

## Pattern Assignments

### `.github/workflows/release.yml` (CI/CD workflow, event-driven)

**Analog:** `.github/workflows/ci.yml`

**Structural scaffold pattern** (ci.yml lines 1–10 — top-level keys, trigger block, concurrency):

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches:
      - main
      - develop
```

The release workflow copies this scaffold but changes the trigger to `push: branches: [main]` only (no `pull_request`, no `develop`) and adds a `concurrency` key and a top-level `permissions` block.

**Action order pattern** (ci.yml lines 17–23 — the pnpm-before-node ordering is load-bearing):

```yaml
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
```

`pnpm/action-setup@v6` MUST appear before `actions/setup-node@v4` so pnpm is on PATH when Node's cache step runs. Copy this order exactly.

**Build step pattern** (ci.yml line 27):

```yaml
      - run: pnpm build
```

The release workflow reuses this step verbatim before handing off to `changesets/action`.

**What the release workflow adds (not in ci.yml — source: RESEARCH.md Pattern 1 + Code Example):**

```yaml
# Top-level additions not present in ci.yml:
concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write        # changesets/action needs to push version commits
  pull-requests: write   # changesets/action creates/updates the Version Packages PR
  id-token: write        # REQUIRED for npm OIDC trusted publishing

# Node version: release workflow uses 24 ONLY (no matrix)
# ci.yml uses matrix: [22, 24]; release.yml must NOT use matrix
        with:
          node-version: 24          # Node 24 ships npm v11+ — required for OIDC (npm/cli#8976)
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

# The changesets/action step replacing ci.yml's test/lint steps:
      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm release     # maps to root package.json: "release": "changeset publish"
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_CONFIG_PROVENANCE: 'true'
          NODE_AUTH_TOKEN: ''       # explicitly clear — prevents setup-node token from shadowing OIDC
```

**Complete release.yml shape to produce:**

```yaml
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
          # Break-glass: if OIDC fails for npm/cli#8976, swap in:
          # NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN_BREAKGLASS }}
```

---

### `.changeset/rename-client.md`, `.changeset/rename-introspection.md`, `.changeset/rename-testcontainers.md` (changeset markers, batch)

**Analog:** None — `.changeset/` directory has no existing `.md` files.

**Pattern source:** RESEARCH.md Code Example "Rename Changeset File" + `.changeset/config.json` lines 1–11.

**Config.json confirms** (lines 3–9): package names are `@godoo/client`, `@godoo/introspection`, `@godoo/testcontainers`; access is `public`; `baseBranch` is `main`. These are the exact strings to use in changeset frontmatter.

**Shape to copy for each file:**

```markdown
---
"@godoo/client": patch
---

Renamed from `@marcfargas/odoo-client`. Migrate by replacing `@marcfargas/odoo-client` with `@godoo/client` in your `package.json`.
```

```markdown
---
"@godoo/introspection": patch
---

Renamed from `@marcfargas/odoo-introspection`. Migrate by replacing `@marcfargas/odoo-introspection` with `@godoo/introspection` in your `package.json`.
```

```markdown
---
"@godoo/testcontainers": patch
---

Renamed from `@marcfargas/odoo-testcontainers`. Migrate by replacing `@marcfargas/odoo-testcontainers` with `@godoo/testcontainers` in your `package.json`.
```

**Why `patch` not `minor`:** The package.json versions (`0.6.0`, `0.2.1`, `0.1.5`) are already at the inherited baseline. `patch` signals "no API change, rename only" and does not cause an unexpected version bump. `changeset publish` will compare `package.json` version to the stub `0.0.0` on the registry and publish the inherited version because `0.6.0 > 0.0.0`.

---

### `scripts/deprecate-marcfargas.sh` (utility, batch)

**Analog:** None — no shell scripts exist in `godoo-ts`.

**Pattern source:** RESEARCH.md Pattern 5 (exact deprecation messages from CONTEXT.md D-04).

**Shape to copy (verbatim messages from CONTEXT.md D-04 are non-negotiable):**

```bash
#!/usr/bin/env bash
# scripts/deprecate-marcfargas.sh
# One-shot deprecation pass for all seven retiring @marcfargas/odoo-* packages.
# Run locally with npm auth active. Each call will prompt for OTP unless
# --otp=<code> is appended; TOTP codes expire in ~30s, so run interactively.

set -euo pipefail

npm deprecate '@marcfargas/odoo-client@*' \
  "Renamed to @godoo/client. Install that package instead — see https://github.com/godoo-dev/godoo-ts."

npm deprecate '@marcfargas/odoo-introspection@*' \
  "Renamed to @godoo/introspection. Install that package instead — see https://github.com/godoo-dev/godoo-ts."

npm deprecate '@marcfargas/odoo-testcontainers@*' \
  "Renamed to @godoo/testcontainers. Install that package instead — see https://github.com/godoo-dev/godoo-ts."

npm deprecate '@marcfargas/odoo-state-manager@*' \
  "Superseded by godoo-stateman (Python). No JS shim — see https://github.com/godoo-dev for the godoo initiative."

npm deprecate '@marcfargas/odoo-cli@*' \
  "Deprecated. No direct replacement — see https://github.com/godoo-dev for the godoo initiative."

npm deprecate '@marcfargas/odoo-mcp@*' \
  "Deprecated. Source preserved for future salvage at https://github.com/marcfargas/odoo-toolbox (archived) targets/odoo-mcp/."

npm deprecate '@marcfargas/odoo-skills@*' \
  "Deprecated. CI-generated knowledge modules — future home TBD in the Atlas KB."
```

**Pattern note:** `set -euo pipefail` is the standard safety header for any shell script in this project (no existing analog, but it is the POSIX convention Marc's stack would expect).

---

### Stub `package.json` files ×3 (ephemeral, `release/stub-bootstrap` branch only)

**Analog:** `packages/client/package.json` (lines 1–49)

**What to copy from the analog:**
- `"license": "LGPL-3.0"` (analog line 6)
- `"author": "Marc Fargas <marc@marcfargas.com>"` (analog line 7)
- `"repository"` block shape (analog lines 40–44) — same `type`, `url`, and `directory` pattern
- `"publishConfig": { "access": "public" }` (analog lines 46–48)

**What to strip vs. analog:** Remove `type`, `description`-expansion, `keywords`, `types`, `exports`, `files` array (stub has no dist), `scripts`, `dependencies`, `devDependencies`, `homepage`. Add a minimal `"main": "./index.js"` pointing to the throw-on-require entrypoint.

**Shape to produce for each stub:**

`@godoo/client` stub `package.json`:
```json
{
  "name": "@godoo/client",
  "version": "0.0.0",
  "description": "Placeholder — install the latest release",
  "license": "LGPL-3.0",
  "author": "Marc Fargas <marc@marcfargas.com>",
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

`@godoo/introspection` stub — identical except `"name": "@godoo/introspection"` and `"directory": "packages/introspection"`.

`@godoo/testcontainers` stub — identical except `"name": "@godoo/testcontainers"` and `"directory": "packages/testcontainers"`.

**Stub `index.js` shape (same for all three, only package name varies in message):**
```js
// index.js
throw new Error(
  "@godoo/client@0.0.0 is a placeholder for trusted publishing setup. " +
  "Install the latest release: npm install @godoo/client"
);
```

**Stub directory location:** Outside the pnpm workspace. Do NOT place under `packages/` (pnpm-workspace.yaml includes `packages/*` — changesets would discover them). Options: (a) a `_stubs/` directory at repo root with the three subdirectories, on the `release/stub-bootstrap` branch only; the root `package.json` is not modified (no workspace entry added).

---

## Shared Patterns

### Workflow step ordering (pnpm before node)
**Source:** `.github/workflows/ci.yml` lines 17–23
**Apply to:** `release.yml`

```yaml
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # release.yml adds fetch-depth: 0; ci.yml omits it
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
```

`pnpm/action-setup@v6` before `actions/setup-node@v4` is load-bearing. The cache step inside `setup-node` requires pnpm to be on PATH.

### Release script reference
**Source:** `package.json` line 21
**Apply to:** `release.yml` `changesets/action` `publish` input

```json
"release": "changeset publish"
```

The `publish: pnpm release` input in `changesets/action` maps to this script. No new script is needed.

### Package naming and repository fields
**Source:** `packages/client/package.json` lines 1, 40–48 (replicated in introspection and testcontainers)
**Apply to:** All three stub `package.json` files

```json
  "license": "LGPL-3.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/godoo-dev/godoo-ts.git",
    "directory": "packages/client"
  },
  "publishConfig": {
    "access": "public"
  }
```

These three fields are identical across all packages (directory differs). Copy verbatim into each stub.

### Changeset config (package names)
**Source:** `.changeset/config.json` lines 1–11
**Apply to:** All three `.changeset/rename-*.md` files

The changeset frontmatter package names must exactly match the `name` fields in each `package.json` — confirmed as `"@godoo/client"`, `"@godoo/introspection"`, `"@godoo/testcontainers"`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.changeset/rename-*.md` | config | batch | No changeset files exist yet; `.changeset/` directory has only `config.json` |
| `scripts/deprecate-marcfargas.sh` | utility | batch | No shell scripts exist in this repo; no analog available |

For these files, use the verbatim patterns from RESEARCH.md (Pattern 3 and Pattern 5 respectively) — they were derived from official npm documentation and have HIGH confidence.

---

## Metadata

**Analog search scope:** `.github/workflows/`, `.changeset/`, `packages/*/package.json`, `scripts/`, root `package.json`
**Files scanned:** 8 (ci.yml, config.json, 3 package package.json files, root package.json, glob of scripts/, glob of .changeset/*.md)
**Pattern extraction date:** 2026-05-26
