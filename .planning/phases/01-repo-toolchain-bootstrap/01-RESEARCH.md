# Phase 1: Repo & Toolchain Bootstrap - Research

**Researched:** 2026-05-19
**Domain:** TypeScript pnpm-workspace library monorepo toolchain (tsdown, Biome, lefthook, vitest, changesets, GitHub Actions)
**Confidence:** HIGH

## Summary

Phase 1 bootstraps an empty public `godoo-ts` monorepo with a complete
build/test/release toolchain. The toolchain shape is fully locked by decisions
D-01..D-10: pnpm workspaces, ESM-only tsdown builds with `.d.ts` declarations,
Biome single lint+format tool, lefthook pre-commit hooks, vitest test runner,
changesets release pipeline, and GitHub Actions CI on Node 22+24 (Ubuntu only).

The most significant finding is that **tsup is no longer actively maintained**
(per the tsup GitHub repo notice) and its documented replacement, **tsdown**,
is ESM-first, has a substantially simpler config for this use case, and is the
current recommended choice in the rolldown/void(0) ecosystem. tsdown 0.22.0 was
published 2026-05-07 and requires Node ≥ 22.18.0, aligning exactly with the
Node 22+24 CI matrix locked in D-05.

TypeScript 6.0 (published 2026-04-16) introduces breaking-change default shifts —
`module` now defaults to `esnext`, `strict` defaults to `true`, `types` now
defaults to `[]` — which means the tsconfig base must be explicit rather than
relying on old defaults. The `moduleResolution: "node"` value used in the
odoo-toolbox baseline is deprecated in TypeScript 6 (use `nodenext` or `bundler`).

**Primary recommendation:** Use tsdown (not tsup) as the build tool. tsdown is
ESM-first with automatic dts generation and simpler config for a pure-ESM
library. Wire `isolatedDeclarations: true` in the base tsconfig for fast .d.ts
generation via oxc-transform. Set `types: ["node"]` explicitly (TypeScript 6
default is now `[]`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Throwaway example package at `packages/_example` (real `index.ts` +
  passing vitest test). Exercises pnpm install, tsdown build, vitest, and
  `tsconfig extends`. Phase 2 deletes it.
- **D-02:** Shared tsdown config emits **ESM-only + `.d.ts`**. No CJS. Every
  package inherits this default.
- **D-03:** **Biome** as single lint+format tool (`biome.json`). Replaces ESLint+Prettier.
- **D-04:** **lefthook** pre-commit hook running Biome check on staged files.
  Replaces husky+lint-staged.
- **D-05:** CI matrix: **Node 22 + Node 24** (Ubuntu only). Node 20 excluded (EOL).
- **D-06:** CI on **Ubuntu only** (no macOS/Windows matrix).
- **D-07:** Phase 1 CI jobs: Biome check, typecheck, tsdown build, vitest. No
  Docker/Odoo integration job (deferred to Phase 2).
- **D-08:** Create GitHub repo autonomously via `gh repo create godoo-dev/godoo-ts
  --public` (LGPL-3.0). `godoo-dev` org exists, `gh` is authenticated.
- **D-09:** Default branch = `main` (release), `develop` = working branch.
  Branch protection ruleset on `main` requires CI pass before merge, no required
  reviews.
- **D-10:** `CLAUDE.md` already `@`-imports `../godoo-hq/UMBRELLA_CLAUDE.md`.
  BOOT-04 is satisfied — Phase 1 only needs to verify the import resolves.

### Claude's Discretion
- Exact tsconfig file naming/layout (e.g. `tsconfig.base.json` + per-package
  `extends`), `biome.json` rule selection beyond Biome's recommended set,
  changesets config details (`@changesets/changelog-github`, base branch),
  the example package's internal name, `.gitignore`/README scaffolding, and
  pnpm/Node version pinning files.
- Strict TS with no `any` is a hard project constraint and must be enforced.

### Deferred Ideas (OUT OF SCOPE)
- Docker/Odoo integration-test CI job (Phase 2 with `@godoo/testcontainers`)
- Per-package build-format overrides (CJS output) — Phase 2 decision
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOT-01 | Public `godoo-ts` repo under `godoo-dev` org, local repo wired to remote | D-08 locks this: `gh repo create godoo-dev/godoo-ts --public` + `git remote add origin` + push |
| BOOT-02 | pnpm-workspace monorepo scaffold — workspace manifest, root tsconfig, shared lint/format config | pnpm-workspace.yaml format, tsconfig.base.json pattern, biome.json at root |
| BOOT-03 | Build, test, release pipelines green — tsdown builds, vitest, changesets, GitHub Actions CI | tsdown 0.22.0 + vitest 4.1.6 + changesets 2.31.0 + GHA pnpm/action-setup@v6 pattern |
| BOOT-04 | `CLAUDE.md` `@`-imports `../godoo-hq/UMBRELLA_CLAUDE.md` | Already done (D-10). Verify `../godoo-hq/UMBRELLA_CLAUDE.md` resolves from clone path |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build/bundle | Build tooling (tsdown) | — | Library bundler, not app server |
| Type checking | TypeScript compiler | tsdown dts | `tsc --noEmit` for CI typecheck; tsdown handles dts emit |
| Lint + format | Biome (single process) | — | Single tool replaces ESLint + Prettier; runs at root |
| Pre-commit gates | lefthook | Biome | lefthook invokes Biome on staged files |
| Test runner | vitest (root projects config) | per-package vitest.config.ts | Root orchestrates; packages can override |
| Release versioning | changesets | npm publish | changesets manages CHANGELOG + version bump; publish is Phase 3 |
| CI orchestration | GitHub Actions | pnpm/action-setup + cache | Matrix job on ubuntu-latest, Node 22+24 |
| Repo creation | gh CLI | git remote | Programmatic; `godoo-dev` org already exists |
| Branch protection | GitHub Rulesets API | gh api | REST API via `gh api` POST call |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 11.1.3 | Package manager + workspace orchestration | ESM-native, workspace:* protocol, pnpm-workspace.yaml; published 2026-05-18 |
| tsdown | 0.22.0 | Library bundler (replaces tsup) | ESM-first, auto-dts via rolldown-plugin-dts, simpler config than tsup; tsup explicitly "not actively maintained" as of 2025 |
| typescript | 6.0.3 | Type checking | Current stable; v6 brings breaking defaults — must be explicit in tsconfig |
| @biomejs/biome | 2.4.15 | Lint + format (single tool) | Replaces ESLint+Prettier; officially recommended with lefthook for staged-file flow |
| lefthook | 2.1.7 | Git hooks manager | Fast, cross-platform, dep-free; Biome docs recommend lefthook specifically |
| vitest | 4.1.6 | Unit test runner | Current ecosystem standard for TS library testing; projects config for monorepo |
| @changesets/cli | 2.31.0 | Release versioning + changelogs | Standard monorepo release tool; baseBranch=main |
| @changesets/changelog-github | 0.7.0 | GitHub-linked changelogs | Adds commit links + contributor attribution to changelogs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tsconfig/node22 | 22.0.5 | Base tsconfig for Node 22 targets | Extend in tsconfig.base.json for correct Node 22 lib/target/module defaults |
| @vitest/coverage-v8 | 4.1.6 | V8 coverage provider | Add when coverage reporting is needed (not required for Phase 1 green bar) |
| @types/node | (current) | Node.js type definitions | Required — TypeScript 6 `types: []` default means you must list it explicitly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsdown | tsup 8.5.1 | tsup is no longer actively maintained (GitHub notice); tsdown is the documented replacement, ESM-first, faster via Rolldown |
| tsdown | unbuild | unbuild is a viable alternative but less ecosystem momentum in mid-2026; tsdown has explicit migration guide from tsup |
| Biome | ESLint 9 + Prettier 3 | Single-tool Biome is faster and simpler; ESLint+Prettier is what odoo-toolbox uses — this is the explicit modernization step |
| lefthook | husky + lint-staged | lefthook is dependency-free binary, cross-platform, simpler config; husky+lint-staged is what odoo-toolbox uses — explicit replacement |
| vitest root projects | per-package vitest only | Root `projects` config enables `pnpm run test` at root without manual script orchestration |

**Installation (root devDependencies):**
```bash
pnpm add -D -w typescript tsdown vitest @biomejs/biome lefthook @changesets/cli @changesets/changelog-github @tsconfig/node22 @types/node
```

**Note:** `pnpm` itself is installed globally (`npm install -g pnpm`) or via `corepack enable && corepack prepare pnpm@11 --activate`.

**Version verification (all verified against npm registry 2026-05-19):**
- pnpm 11.1.3 published 2026-05-18
- tsdown 0.22.0 published 2026-05-07, requires Node ≥ 22.18.0
- typescript 6.0.3 published 2026-04-16
- @biomejs/biome 2.4.15 published 2026-05-09
- lefthook 2.1.7 published 2026-05-19
- vitest 4.1.6 published 2026-05-11
- @changesets/cli 2.31.0 published 2026-04-17
- @changesets/changelog-github 0.7.0 (verified on npm)
- @tsconfig/node22 22.0.5 published 2025-11-18

## Package Legitimacy Audit

> slopcheck run against npm ecosystem (2026-05-19).

| Package | Registry | slopcheck | Source Repo | Disposition |
|---------|----------|-----------|-------------|-------------|
| pnpm | npm | OK | github.com/pnpm/pnpm | Approved |
| tsdown | npm | OK | github.com/rolldown/tsdown | Approved |
| tsup | npm | OK | github.com/egoist/tsup | Approved (kept as alt ref, not used) |
| typescript | npm | OK | github.com/microsoft/TypeScript | Approved |
| @biomejs/biome | npm | OK | github.com/biomejs/biome | Approved |
| lefthook | npm | OK | github.com/evilmartians/lefthook | Approved |
| vitest | npm | SUS (name similarity with `vite`) | github.com/vitest-dev/vitest | Approved — confirmed legitimate: vitest.dev, 2021-12-03 creation, vitest-dev org on GitHub; slopcheck typosquat concern is false positive |
| @changesets/cli | npm | OK | github.com/changesets/changesets | Approved |
| @changesets/changelog-github | npm | OK | github.com/changesets/changesets | Approved |
| @tsconfig/node22 | npm | OK | github.com/tsconfig/bases | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** vitest — false positive confirmed; legitimate package since 2021 with vitest-dev GitHub org

## Architecture Patterns

### System Architecture Diagram

```
developer workstation
        |
        | git commit
        v
[lefthook pre-commit]
        |
        | staged files (*.ts, *.json, etc.)
        v
[biome check --write]  ──→  fix + re-stage
        |
        v
git push → develop branch
        |
        v
[GitHub Actions CI]
    ┌───┴───┐
  Node 22  Node 24
    │         │
    ▼         ▼
pnpm install (frozen-lockfile)
    │
    ├── biome check        (lint+format gate)
    ├── tsc --noEmit       (typecheck gate)
    ├── tsdown build       (build gate)
    └── vitest run         (unit test gate)
        │
        ▼
    all green → push allowed

develop → PR → main
        |
        | (CI required by ruleset)
        v
[changeset version] → version bumps + CHANGELOG
[changeset publish] → npm (Phase 3 only)
```

### Recommended Project Structure
```
godoo-ts/
├── .changeset/
│   └── config.json           # baseBranch: main, access: public, changelog-github
├── .github/
│   └── workflows/
│       └── ci.yml            # Node 22+24 matrix, pnpm cache
├── packages/
│   └── _example/             # Throwaway proof package (D-01)
│       ├── src/
│       │   └── index.ts
│       ├── tests/
│       │   └── index.test.ts
│       ├── package.json      # name: @godoo/example (private: true), type: module
│       ├── tsconfig.json     # extends: ../../tsconfig.base.json
│       └── tsdown.config.ts  # entry: ./src/index.ts, format: esm, dts: true
├── biome.json                # recommended + TypeScript rules, lint+format
├── lefthook.yml              # pre-commit: biome check on staged files
├── package.json              # private: true, pnpm workspace root
├── pnpm-workspace.yaml       # packages: ['packages/*']
├── tsconfig.base.json        # shared strict TypeScript config (Node 22 target)
├── tsconfig.json             # root: references only (no include)
└── vitest.config.ts          # test.projects: ['packages/*']
```

### Pattern 1: pnpm Workspace Manifest
**What:** `pnpm-workspace.yaml` at root defines which directories are workspace packages
**When to use:** Always present in pnpm monorepo
```yaml
# Source: pnpm.io/workspaces
packages:
  - 'packages/*'
```

### Pattern 2: Root tsconfig.base.json (TypeScript 6 explicit)
**What:** Shared compiler options that all package tsconfigs extend. TypeScript 6 requires explicit settings for options that previously had safe defaults.
**When to use:** Single base file; packages extend with only their `rootDir`/`outDir` overrides
```json
// Source: typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
// + @tsconfig/node22 as basis
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedDeclarations": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "resolveJsonModule": true
  }
}
```

**Critical TypeScript 6 notes:**
- `module: "nodenext"` is now correct; `module: "commonjs"` is still valid but outdated for ESM-only libraries
- `types: ["node"]` must be explicit — TypeScript 6 defaults `types` to `[]` (empty)
- `moduleResolution: "node"` is deprecated in TypeScript 6 — use `"nodenext"` or `"bundler"`
- `isolatedDeclarations: true` enables fast oxc-transform dts generation in tsdown

**Per-package tsconfig.json (minimal):**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src", "tests"]
}
```

### Pattern 3: tsdown Config (ESM-only + dts)
**What:** Per-package `tsdown.config.ts` for ESM-only output with auto-dts
**When to use:** Every buildable package in `packages/`
```typescript
// Source: tsdown.dev/guide/getting-started
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
})
```

**package.json exports field for each package:**
```json
{
  "name": "@godoo/example",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsdown",
    "test": "vitest run"
  }
}
```

**Note on tsdown exports auto-generation:** tsdown can auto-populate the `exports` field with `exports: true` in config, but starting with manual definition is safer for Phase 1 — it's explicit and verifiable.

### Pattern 4: Biome Configuration
**What:** Single `biome.json` at monorepo root providing lint + format for all packages
**When to use:** Root-level only; packages use `"root": false` if they need overrides (not needed for Phase 1)
```json
// Source: biomejs.dev/reference/configuration
{
  "$schema": "https://biomejs.dev/schemas/2.4.15/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": ["**/dist/**", "**/node_modules/**", "**/*.d.ts"]
  }
}
```

**`noExplicitAny: "error"` is required** to enforce the "no `any`" project constraint (CLAUDE.md).

### Pattern 5: lefthook Pre-commit Hook
**What:** `lefthook.yml` at root runs Biome on staged files before each commit
**When to use:** Activated via `lefthook install` post-clone
```yaml
# Source: biomejs.dev/recipes/git-hooks (official Biome + lefthook recipe)
pre-commit:
  commands:
    check:
      glob: "*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}"
      run: pnpm biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true
```

**`stage_fixed: true`** re-stages files that Biome auto-fixed so the commit includes the fixes.

Activate with: `pnpm lefthook install`

### Pattern 6: Vitest Root Projects Config
**What:** Root `vitest.config.ts` using `projects` to discover per-package test suites
**When to use:** Every monorepo needing `pnpm test` at root to run all packages
```typescript
// Source: vitest.dev/guide/projects
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
```

**Key vitest 4 note:** The `workspace` config key (formerly `vitest.workspace.ts`) is
deprecated as of vitest 3.2 and replaced by `test.projects` in the root `vitest.config.ts`.

### Pattern 7: GitHub Actions CI Workflow
**What:** `.github/workflows/ci.yml` with pnpm cache + Node 22+24 matrix
**When to use:** Phase 1 CI — Biome check, typecheck, build, unit tests
```yaml
# Source: pnpm.io/continuous-integration + actions/setup-node docs
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome check .
      - run: pnpm tsc --noEmit
      - run: pnpm build
      - run: pnpm test
```

**pnpm frozen-lockfile:** In CI, pnpm automatically switches to `--frozen-lockfile` mode.
As of pnpm 11, an incompatible lockfile version fails the install (no silent rewrite).

### Pattern 8: Changesets Configuration
**What:** `.changeset/config.json` wiring changesets to `main` base branch with GitHub changelog
```json
// Source: changesets/changesets docs/config-file-options.md
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "godoo-dev/godoo-ts" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**`access: "public"`** is required for `@godoo/*` scoped packages to publish without the
`--access public` flag on each `npm publish`. Default is `"restricted"` which would block
publishing scoped packages.

### Pattern 9: GitHub Repo + Branch Protection (programmatic)
**What:** Create repo + set ruleset requiring CI before merge on `main`
```bash
# Create repo (D-08)
# Source: gh cli docs
gh repo create godoo-dev/godoo-ts --public --license LGPL-3.0

# Set default branch and push
git remote add origin https://github.com/godoo-dev/godoo-ts.git
git push -u origin main
git checkout -b develop
git push -u origin develop

# Create branch protection ruleset (D-09)
# Must be done AFTER CI job names are known (job name = "ci (22)" and "ci (24)")
# Source: docs.github.com/en/rest/repos/rules
gh api repos/godoo-dev/godoo-ts/rulesets \
  --method POST \
  --field name="require-ci-on-main" \
  --field target="branch" \
  --field enforcement="active" \
  --field conditions='{"ref_name":{"include":["refs/heads/main"],"exclude":[]}}' \
  --field rules='[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"ci (22)"},{"context":"ci (24)"}],"strict_required_status_checks_policy":false}}]'
```

**Timing note:** The status check context strings (`ci (22)`, `ci (24)`) come from the
GitHub Actions job name + matrix value. The ruleset can only reference checks that have
run at least once — create the protection ruleset **after** the first CI run completes.

### Anti-Patterns to Avoid
- **`moduleResolution: "node"` in TypeScript 6:** Deprecated; causes import resolution
  failures for `.js` extensions in ESM. Use `"nodenext"` or `"bundler"`.
- **Relying on TypeScript 6 defaults:** `strict`, `module`, `target`, and `types` all
  changed defaults; always be explicit in `tsconfig.base.json`.
- **`tsup` for new projects:** Explicitly "not actively maintained" per GitHub README;
  use `tsdown` instead.
- **`vitest.workspace.ts` file:** Deprecated in vitest 3.2+. Use `test.projects` in root
  `vitest.config.ts`.
- **pnpm lockfile mismatch in CI:** CI uses pnpm 11 which refuses to silently overwrite
  incompatible lockfiles — `pnpm install` will fail if lockfile was generated with a
  different major. Pin pnpm version in `packageManager` field and `pnpm/action-setup`.
- **`access: "restricted"` for @godoo/* packages:** Default for scoped packages; will
  block npm publish. Must set `access: "public"` in changesets config.
- **Branch protection before first CI run:** The status check name must exist in GitHub's
  records before you can require it in a ruleset. Wire the protection after the first push.
- **Missing `types: ["node"]` in TypeScript 6:** Without it, `process`, `Buffer`, `__dirname`
  etc. are unknown. TypeScript 6 no longer auto-includes `@types` packages.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Staged-file lint | Custom shell script reading git diff | lefthook + `{staged_files}` | lefthook handles cross-platform staging, re-staging, and parallel execution |
| `.d.ts` generation | tsc in watch + copy scripts | tsdown `dts: true` | tsdown uses rolldown-plugin-dts; with `isolatedDeclarations` uses oxc-transform (much faster) |
| Changelog entries | Manual CHANGELOG edits | changesets | changesets handles per-package versioning, internal dependency bumps, and GitHub-linked CHANGELOG |
| pnpm CI caching | Manual `actions/cache` with hash | `pnpm/action-setup@v6` + `cache: 'pnpm'` in setup-node | Built-in cache key from pnpm-lock.yaml hash; automatic frozen-lockfile in CI |
| Workspace-aware test running | Per-package CI jobs or Makefile | vitest `test.projects: ['packages/*']` | Single `pnpm test` at root discovers and runs all packages |

**Key insight:** Every toolchain problem this phase faces has a purpose-built solution.
The odoo-toolbox baseline (npm workspaces, husky, lint-staged, ESLint+Prettier, per-package
tsc) hand-rolled what is now handled by dedicated tools. The modernization pass replaces
each of those with a more capable drop-in.

## Common Pitfalls

### Pitfall 1: tsdown Node.js Version Requirement
**What goes wrong:** tsdown 0.22.0 requires Node ≥ 22.18.0. Running on Node 22.0.0–22.17.x
will fail at tsdown install or execution.
**Why it happens:** tsdown uses modern Node APIs not available in earlier Node 22 patch versions.
**How to avoid:** Pin `engines.node` in root `package.json` to `">=22.18.0"`. The CI matrix
uses Node 22 (latest 22.x) which should satisfy this, but verify `node --version` in CI.
**Warning signs:** `tsdown: Cannot find module` or unexpected `SyntaxError` during build in CI.

### Pitfall 2: TypeScript 6 moduleResolution Deprecation
**What goes wrong:** `moduleResolution: "node"` is deprecated in TypeScript 6. ESM packages
with `.js` extension imports resolve incorrectly; TypeScript may warn about the deprecated
option.
**Why it happens:** odoo-toolbox's `tsconfig.json` uses `"moduleResolution": "node"` and
`"module": "commonjs"` — both wrong for an ESM-only library targeting Node 22+.
**How to avoid:** Use `"module": "nodenext"` and `"moduleResolution": "nodenext"` in
`tsconfig.base.json`. This enables correct `.js` extension handling for ESM.
**Warning signs:** TypeScript deprecation warnings; import resolution failures in the
example package tests.

### Pitfall 3: isolatedDeclarations Requires Explicit Return Types
**What goes wrong:** Enabling `isolatedDeclarations: true` (recommended for fast dts) requires
every exported function to have an explicitly annotated return type. Implicit return types
cause `TS9007` errors.
**Why it happens:** `isolatedDeclarations` enables per-file dts emit without full type
inference — requires that types are unambiguous from each file in isolation.
**How to avoid:** In the example package's `index.ts`, always annotate exported function
return types explicitly: `export function hello(): string { ... }`. Biome's linter can
be configured to enforce this.
**Warning signs:** `error TS9007: Declaration emit for this file requires type resolving
across files.`

### Pitfall 4: Vitest `workspace` vs `projects`
**What goes wrong:** Creating a `vitest.workspace.ts` file (old pattern) triggers a
deprecation warning in vitest 4. The `workspace` key in config is removed in vitest 3.2+.
**Why it happens:** vitest renamed the feature from `workspace` to `projects` in v3.2.
The old file-based config (`vitest.workspace.ts`) still works but is deprecated.
**How to avoid:** Use `test.projects: ['packages/*']` in root `vitest.config.ts`.
**Warning signs:** `DeprecationWarning: workspace config is deprecated` in test output.

### Pitfall 5: Biome Schema Version Pinning
**What goes wrong:** The `$schema` URL in `biome.json` references a specific version
(e.g., `2.3.11`). If the version string doesn't match the installed Biome version, IDE
tooling may show schema errors.
**Why it happens:** Biome embeds schema version in the URL.
**How to avoid:** Run `pnpm biome init` to generate `biome.json` with the correct schema
URL for the installed version, then customize. Current version: 2.4.15 → schema:
`https://biomejs.dev/schemas/2.4.15/schema.json`.
**Warning signs:** IDE schema validation errors; `biome check` reports schema version mismatch.

### Pitfall 6: Branch Ruleset Before First CI Run
**What goes wrong:** Creating the `main` branch protection ruleset requiring `ci (22)` and
`ci (24)` status checks BEFORE those check names exist in GitHub will either fail the API
call or create a ruleset that can never be satisfied (no prior runs = no known check names).
**Why it happens:** GitHub only knows status check names after they have been reported at
least once from a push/PR.
**How to avoid:** Push the CI workflow first (on `develop`), let it run once to completion,
then create the branch protection ruleset referencing the established check names.
**Warning signs:** `gh api` call returns 422 Unprocessable Entity for unknown check contexts.

### Pitfall 7: pnpm Lockfile Version Mismatch
**What goes wrong:** Local pnpm version differs from CI pnpm version → lockfile format
mismatch → pnpm 11 refuses to install and CI fails.
**Why it happens:** pnpm 11 enforces lockfile compatibility strictly; older versions
silently regenerated the lockfile.
**How to avoid:** Set `"packageManager": "pnpm@11.1.3"` in root `package.json`. Pin
`version: 11` in `pnpm/action-setup@v6`. Commit both `package.json` and `pnpm-lock.yaml`
together (per lockfile-discipline rule).
**Warning signs:** `ERR_PNPM_LOCKFILE_BREAKING_CHANGE` in CI install step.

### Pitfall 8: `@changesets/changelog-github` Requires GITHUB_TOKEN
**What goes wrong:** The `@changesets/changelog-github` formatter requires the
`GITHUB_TOKEN` environment variable to resolve commit/PR links. Without it, changelog
generation may fail or produce bare commit hashes.
**Why it happens:** It uses the GitHub REST API to enrich changelog entries.
**How to avoid:** In the GitHub Actions release workflow (Phase 3), pass
`env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to the changeset version/publish step.
For Phase 1, the changesets config is wired but the release workflow is not yet triggered.
**Warning signs:** `Error: Could not get commit message` or bare SHA references in CHANGELOG.

## Code Examples

### Example Package `packages/_example/src/index.ts`
```typescript
// Minimal example proving the toolchain works
// Explicit return type required for isolatedDeclarations
export function greet(name: string): string {
  return `Hello from godoo-ts, ${name}!`
}

export const VERSION: string = '0.0.1'
```

### Example Package `packages/_example/tests/index.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { greet, VERSION } from '../src/index.js'

describe('greet', () => {
  it('returns greeting with name', () => {
    expect(greet('world')).toBe('Hello from godoo-ts, world!')
  })
})

describe('VERSION', () => {
  it('is a string', () => {
    expect(typeof VERSION).toBe('string')
  })
})
```

**Note the `.js` extension** on the import: `from '../src/index.js'`. This is required
with `moduleResolution: "nodenext"` — TypeScript resolves `.ts` files when you write `.js`
(the "dual extension" pattern), but the import must use the output extension.

## State of the Art

| Old Approach (odoo-toolbox) | Current Approach (godoo-ts) | When Changed | Impact |
|-----------------------------|----------------------------|--------------|--------|
| tsup for bundling | tsdown (rolldown-based) | 2024–2025 tsup maintenance halt | ESM-first, faster, simpler config |
| ESLint + Prettier (two tools) | Biome (one tool) | Biome stable 2024+ | Single config, no plugin conflicts, faster |
| husky + lint-staged | lefthook | 2023+ | Zero npm deps, cross-platform binary, simpler YAML |
| `moduleResolution: "node"` | `moduleResolution: "nodenext"` | TypeScript 5.0+ (required in TS 6) | Correct ESM `.js` extension resolution |
| `module: "commonjs"` | `module: "nodenext"` (or `esnext`) | TypeScript 5.0+ / TS 6 default | ESM-native output |
| `vitest.workspace.ts` file | `test.projects` in `vitest.config.ts` | vitest 3.2 | Simplified monorepo test config |
| npm workspaces | pnpm workspaces | pnpm matured 2022+ | `workspace:*` protocol, faster installs, strict dep isolation |
| Per-package `tsc` build | tsdown at package level | tsdown 0.x | Bundled ESM output with dts in one command |

**Deprecated/outdated:**
- `tsup`: Explicitly "not actively maintained" per GitHub README; tsdown is the replacement
- `vitest.workspace.ts` file pattern: Deprecated in vitest 3.2
- `moduleResolution: "node"`: Deprecated in TypeScript 6 (emit deprecation warning)
- `module: "commonjs"` for ESM-only libraries: Works but semantically wrong
- Node 20: Reached EOL April 2026 — excluded from CI matrix per D-05

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | tsup is "not actively maintained" — based on GitHub README notice reported by WebFetch | Standard Stack, Pitfalls | If tsup resumes maintenance, tsdown is still the better ESM-first choice; risk is low |
| A2 | `ci (22)` and `ci (24)` are the status check context names produced by a matrix job named `ci` with `node-version: [22, 24]` | Architecture Patterns Pattern 9 | Actual names depend on exact workflow yaml; verify after first CI run before creating ruleset |
| A3 | `pnpm/action-setup@v6` is the correct current version (v6.0.8) | Architecture Patterns Pattern 7 | If v7 released, v6 still works; minimal risk |
| A4 | Biome 2.4.15 schema URL is `https://biomejs.dev/schemas/2.4.15/schema.json` | Architecture Patterns Pattern 4 | Use `pnpm biome init` to generate correct URL automatically — don't hardcode |

## Open Questions (RESOLVED)

1. **Should the root `package.json` use `"packageManager": "pnpm@11.1.3"` or just `"pnpm@11"`?**
   - What we know: `packageManager` field supports both exact and range versions via corepack
   - What's unclear: Whether `pnpm/action-setup@v6` respects the `packageManager` field or requires explicit `version:` input
   - RESOLVED: Set both — `"packageManager": "pnpm@11.1.3"` in root `package.json` AND `version: 11` in the action; they don't conflict

2. **tsdown 0.22.0 is pre-1.0 — is it stable enough for Phase 1?**
   - What we know: `engines.node: "^22.18.0 || >=24.0.0"` matches the CI matrix; published 2026-05-07; rolldown.dev org; used by vue/core maintainers
   - What's unclear: Whether pre-1.0 minor bumps introduce breaking changes
   - RESOLVED: Pin exact version in `package.json` (`"tsdown": "0.22.0"`). Accept the pre-1.0 risk — it's the only actively maintained ESM-first library bundler in this ecosystem, and tsup is explicitly inactive.

3. **How should the `develop` branch be set up in the new repo?**
   - What we know: D-09 says default branch = `main`, working branch = `develop`; `gh repo create` sets `main` as default
   - What's unclear: Whether to push `develop` immediately after creating the repo or defer until first commit
   - RESOLVED: After initial scaffold commit on `main`, immediately create and push `develop` from `main`. All subsequent Phase 1 work goes on `develop`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| gh CLI | D-08 repo creation, D-09 ruleset | Check with `gh --version` | unknown — verify | No fallback; required for automation |
| git | All commits/pushes | ✓ (git repo exists) | unknown | — |
| Node.js 22+ | tsdown requirement, CI matrix | ✓ (assumed — engines.node >=24 in odoo-toolbox) | ≥22.18.0 needed | Update Node if below 22.18.0 |
| pnpm | Package manager | Check with `pnpm --version` | Need ≥11.x | `npm install -g pnpm@11` |
| corepack | pnpm version management | Available in Node 22+ | — | `npm install -g pnpm` directly |

**Pre-execution checks the planner should include:**
- `gh auth status` — confirm gh is authenticated to godoo-dev org
- `node --version` — must be ≥ 22.18.0 (tsdown hard requirement)
- `pnpm --version` — must be ≥ 11.x; install/upgrade if needed
- `ls ../godoo-hq/UMBRELLA_CLAUDE.md` — verify umbrella import path resolves (BOOT-04)

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config.json

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 1 has no auth surfaces |
| V3 Session Management | No | No session management |
| V4 Access Control | Partial | Branch protection ruleset on `main` enforces access control at repo level |
| V5 Input Validation | No | No runtime user input — build toolchain only |
| V6 Cryptography | No | No crypto in toolchain bootstrap |
| V7 Error Handling | No | Not applicable |
| V14 Configuration | Partial | Secrets not committed: `.env` not present; `GITHUB_TOKEN` only used in CI env, not in repo files |

### Known Threat Patterns for Toolchain Bootstrap

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply chain: malicious postinstall script | Tampering | slopcheck verified all packages; lefthook postinstall is benign hook installer |
| Lockfile poisoning | Tampering | `--frozen-lockfile` in CI; commit lockfile with `package.json` (lockfile-discipline rule) |
| Secrets in committed files | Information Disclosure | No secrets in Phase 1; `GITHUB_TOKEN` consumed as env var in GHA, never logged |
| Force-push to main | Elevation of Privilege | Branch protection ruleset `main` blocks force pushes (add `{"type":"non_fast_forward"}` to ruleset rules) |

**Recommendation:** Add `{"type": "non_fast_forward"}` rule to the `main` branch ruleset to block force-pushes, alongside the required status checks rule.

## Sources

### Primary (HIGH confidence)
- `pnpm.io/workspaces` — workspace YAML format, workspace:* protocol, changesets recommendation
- `pnpm.io/continuous-integration` — GitHub Actions pnpm setup pattern, frozen-lockfile behavior
- `biomejs.dev/recipes/git-hooks/` — official Biome + lefthook staged-files configuration
- `biomejs.dev/reference/configuration/` — biome.json schema, monorepo extends pattern
- `vitest.dev/guide/projects` — vitest 4 projects config replacing deprecated workspace
- `typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html` — TS 6 breaking changes (strict default, module/moduleResolution defaults, types default)
- `tsdown.dev/guide/getting-started` — tsdown installation, ESM default, dts auto-detection
- `tsdown.dev/options/dts` — isolatedDeclarations + oxc-transform, dts config options
- `tsdown.dev/guide/migrate-from-tsup` — tsup→tsdown mapping, default differences
- `github.com/changesets/changesets/blob/main/docs/config-file-options.md` — changesets config reference
- `docs.github.com/en/rest/repos/rules` — GitHub Rulesets REST API for branch protection
- npm registry (verified 2026-05-19) — all package versions and publish dates

### Secondary (MEDIUM confidence)
- `alan.norbauer.com/articles/tsdown-bundler/` — practical tsup→tsdown migration guide, confirmed by tsdown official docs
- pkgpulse.com/guides/tsup-vs-tsdown — ecosystem download figures (~6M/wk tsup, ~500K/wk tsdown as of early 2026)
- github.com/actions/setup-node caching docs — pnpm cache config, matrix YAML

### Tertiary (LOW confidence)
- A1 (tsup maintenance status): Reported by WebFetch from github.com/egoist/tsup README

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry; all packages confirmed via official repos
- Architecture: HIGH — patterns derived from official docs for each tool
- Pitfalls: HIGH for TypeScript 6 changes (official docs), HIGH for vitest/tsdown patterns; MEDIUM for branch ruleset timing (operational observation)

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (tsdown is pre-1.0 and fast-moving; re-verify version before execution)
