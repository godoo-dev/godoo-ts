# Phase 1: Repo & Toolchain Bootstrap - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 14 new files (toolchain bootstrap — all greenfield)
**Analogs found:** 7 / 14 (partial analogs from `C:/dev/odoo-toolbox`; remainder have no codebase analog)

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `package.json` (root) | config | batch | `C:/dev/odoo-toolbox/package.json` | role-match (deliberate divergence: pnpm workspaces, no husky/ESLint) |
| `pnpm-workspace.yaml` | config | batch | none — npm workspaces in `odoo-toolbox/package.json` | no analog (different mechanism) |
| `tsconfig.base.json` | config | transform | `C:/dev/odoo-toolbox/tsconfig.json` | role-match (deliberate divergence: nodenext, isolatedDeclarations) |
| `tsconfig.json` (root references) | config | transform | `C:/dev/odoo-toolbox/tsconfig.json` | partial-match |
| `biome.json` | config | batch | none — `odoo-toolbox` uses ESLint+Prettier | no analog |
| `lefthook.yml` | config | event-driven | `C:/dev/odoo-toolbox/.husky/pre-commit` | partial-match (replaced by lefthook) |
| `vitest.config.ts` (root) | config | batch | `C:/dev/odoo-toolbox/vitest.config.mts` | role-match (deliberate divergence: test.projects vs. include glob) |
| `.changeset/config.json` | config | batch | `C:/dev/odoo-toolbox/.changeset/config.json` | exact (minor field differences) |
| `.github/workflows/ci.yml` | config | event-driven | `C:/dev/odoo-toolbox/.github/workflows/test.yml` | role-match (deliberate divergence: pnpm, Node matrix, single-job) |
| `packages/_example/package.json` | config | batch | `C:/dev/odoo-toolbox/packages/odoo-client/package.json` | partial-match (tsdown instead of tsc, type:module) |
| `packages/_example/tsconfig.json` | config | transform | `C:/dev/odoo-toolbox/packages/odoo-client/tsconfig.json` | role-match (same extends pattern, different base path) |
| `packages/_example/tsdown.config.ts` | config | transform | none — `odoo-toolbox` uses per-package `tsc` | no analog |
| `packages/_example/src/index.ts` | utility | transform | `C:/dev/odoo-toolbox/packages/odoo-client/src/index.ts` | partial-match (structure only) |
| `packages/_example/tests/index.test.ts` | test | request-response | `C:/dev/odoo-toolbox` unit test files (vitest) | role-match |

---

## Pattern Assignments

### `package.json` (root)

**Analog:** `C:/dev/odoo-toolbox/package.json` (lines 1-83)
**Divergence notes:** npm workspaces → pnpm workspaces; `"workspaces"` field removed; add `"packageManager"` field; husky/ESLint/Prettier devDeps replaced by Biome/lefthook; scripts rewritten for pnpm + tsdown.

**Analog: workspace field pattern** (lines 26-29):
```json
"workspaces": [
  "packages/*",
  "targets/*"
]
```
godoo-ts does NOT use this field. pnpm workspaces are declared in `pnpm-workspace.yaml` instead.

**Analog: scripts structure** (lines 31-57 — shape to copy, content to replace):
```json
"scripts": {
  "build": "...",
  "test": "vitest run",
  "lint": "...",
  "changeset": "changeset",
  "version-packages": "changeset version",
  "release": "changeset publish"
}
```

**Analog: author/license/engines fields** (lines 7-9, 80-82):
```json
"author": "Marc Fargas <marc@marcfargas.com>",
"license": "LGPL-3.0",
"engines": {
  "node": ">=24.0.0"
}
```
godoo-ts must use `"node": ">=22.18.0"` (tsdown hard requirement).

**godoo-ts target shape** (no analog; copy from RESEARCH.md Pattern 1 + Standard Stack):
```json
{
  "name": "godoo-ts",
  "version": "0.0.0",
  "private": true,
  "description": "TypeScript monorepo for @godoo/* Odoo client libraries",
  "author": "Marc Fargas <marc@marcfargas.com>",
  "license": "LGPL-3.0",
  "packageManager": "pnpm@11.1.3",
  "engines": { "node": ">=22.18.0" },
  "scripts": {
    "build": "pnpm -r run build",
    "test":  "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "changeset publish"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "tsdown": "0.22.0",
    "vitest": "4.1.6",
    "@biomejs/biome": "2.4.15",
    "lefthook": "2.1.7",
    "@changesets/cli": "2.31.0",
    "@changesets/changelog-github": "0.7.0",
    "@tsconfig/node22": "22.0.5",
    "@types/node": "latest"
  }
}
```

---

### `pnpm-workspace.yaml`

**Analog:** None — `odoo-toolbox` uses npm `"workspaces"` array in `package.json`.
**Source:** RESEARCH.md Pattern 1 is the sole reference.

**Target shape** (RESEARCH.md Pattern 1):
```yaml
packages:
  - 'packages/*'
```

---

### `tsconfig.base.json`

**Analog:** `C:/dev/odoo-toolbox/tsconfig.json` (lines 1-24)
**Divergence notes (CRITICAL — do not copy the analog values):**
- `"module": "commonjs"` → `"module": "nodenext"` (deprecated in TS 6 for ESM)
- `"moduleResolution": "node"` → `"moduleResolution": "nodenext"` (deprecated in TS 6)
- Add `"isolatedDeclarations": true` (enables oxc-transform dts in tsdown; requires explicit return types on exports)
- Add `"types": ["node"]` (TS 6 default is now `[]` — must be explicit)
- Add `"noUncheckedIndexedAccess": true` (strict project constraint)
- Remove `"composite": true` (that belongs in per-package tsconfig, not the base)
- Remove `"references"` block (root tsconfig.json handles references, not the base)

**Analog: base structure to follow** (`C:/dev/odoo-toolbox/tsconfig.json` lines 1-15):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",      // REPLACE with "nodenext"
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"  // REPLACE with "nodenext"
  }
}
```

**godoo-ts target shape** (RESEARCH.md Pattern 2 — copy this verbatim):
```json
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

---

### `tsconfig.json` (root — references only)

**Analog:** `C:/dev/odoo-toolbox/tsconfig.json` (lines 16-23) — the references block:
```json
"references": [
  { "path": "packages/odoo-client" },
  { "path": "packages/odoo-introspection" },
  { "path": "packages/odoo-state-manager" },
  { "path": "packages/odoo-testcontainers" },
  { "path": "targets/odoo-cli" },
  { "path": "targets/odoo-mcp" }
]
```

**godoo-ts target shape** (Phase 1 has only the example package):
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "files": [],
  "references": [
    { "path": "packages/_example" }
  ]
}
```
`"files": []` prevents the root tsconfig from including any source files directly — it is a references-only config.

---

### `biome.json`

**Analog:** None — `odoo-toolbox` uses ESLint + Prettier. No Biome config exists anywhere in the baseline.
**Source:** RESEARCH.md Pattern 4 is the sole reference.

**Key constraint to enforce:** `"noExplicitAny": "error"` implements the hard "no `any`" rule from CLAUDE.md.

**Target shape** (RESEARCH.md Pattern 4 — copy verbatim, update schema URL to installed version):
```json
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
Note: Run `pnpm biome init` after install to verify the schema URL matches `@biomejs/biome@2.4.15`. Then overwrite with this config (RESEARCH.md Pitfall 5).

---

### `lefthook.yml`

**Analog:** `C:/dev/odoo-toolbox/.husky/pre-commit` (line 1-2):
```bash
npm run lint
npm run test:unit
```
This is the pre-commit concept being replaced. godoo-ts deliberately replaces husky+lint-staged with lefthook for the staged-files pattern.

**godoo-ts target shape** (RESEARCH.md Pattern 5 — copy verbatim):
```yaml
pre-commit:
  commands:
    check:
      glob: "*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}"
      run: pnpm biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true
```
`stage_fixed: true` re-stages auto-fixed files so the commit includes the Biome fixes. Activate via `pnpm lefthook install` after `pnpm install`.

---

### `vitest.config.ts` (root)

**Analog:** `C:/dev/odoo-toolbox/vitest.config.mts` (lines 1-26)

**Analog structure** (the full config — shape to inform, not copy):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    root: '.',
    include: ['packages/*/tests/**/*.test.ts', 'targets/*/tests/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/packaging/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
```

**Divergence notes:**
- `include` glob approach → `test.projects: ['packages/*']` (vitest 4 monorepo pattern; `vitest.workspace.ts` is deprecated per RESEARCH.md Pitfall 4)
- `.mts` extension → `.ts` (simpler; works with nodenext moduleResolution)

**godoo-ts target shape** (RESEARCH.md Pattern 6):
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
```

---

### `.changeset/config.json`

**Analog:** `C:/dev/odoo-toolbox/.changeset/config.json` (lines 1-14) — closest match in the codebase.

**Analog** (full file):
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.2/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "master",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

**Divergence from analog:**
- `"changelog"` → `["@changesets/changelog-github", { "repo": "godoo-dev/godoo-ts" }]` (GitHub-linked entries per D-07 / RESEARCH.md Pattern 8)
- `"baseBranch"` → `"main"` (D-09; odoo-toolbox uses `"master"`)
- `"$schema"` → update to `@changesets/config@3.0.0` schema URL

**godoo-ts target shape** (RESEARCH.md Pattern 8):
```json
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

---

### `.github/workflows/ci.yml`

**Analog:** `C:/dev/odoo-toolbox/.github/workflows/test.yml` (lines 1-356)

**Analog: trigger pattern** (lines 1-18):
```yaml
name: tests
on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]
```

**Analog: job structure** (lines 28-56 — the setup job pattern):
```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('package-lock.json') }}
      - run: npm ci
      - run: npm run build
```

**Divergence from analog:**
- npm → pnpm (`pnpm/action-setup@v6` before `actions/setup-node@v4`; cache key uses `pnpm-lock.yaml`)
- Single node version → Node matrix `[22, 24]` (D-05/D-06)
- Separate jobs (setup/lint/unit-tests/docker/integration) → single `ci` job (D-07; Phase 1 has no Docker/integration)
- `npm ci` → `pnpm install --frozen-lockfile`
- `npm run lint` → `pnpm biome check .`
- Add `pnpm tsc --noEmit` typecheck step
- Branch names: `master` → `main`

**godoo-ts target shape** (RESEARCH.md Pattern 7):
```yaml
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
**CI job name note:** The matrix produces status check contexts `ci (22)` and `ci (24)`. These are the exact strings to use in the branch protection ruleset (D-09). Create the ruleset AFTER the first CI run (RESEARCH.md Pitfall 6).

---

### `packages/_example/package.json`

**Analog:** `C:/dev/odoo-toolbox/packages/odoo-client/package.json` (lines 1-42)

**Analog: core fields** (lines 1-12):
```json
{
  "name": "@marcfargas/odoo-client",
  "version": "0.6.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
```

**Analog: publishConfig** (lines 38-40):
```json
"publishConfig": {
  "access": "public"
}
```

**Divergence from analog:**
- `"build": "tsc"` → `"build": "tsdown"` (D-02)
- `"test": "jest"` → `"test": "vitest run"`
- Add `"type": "module"` (ESM-only, D-02)
- Add `"exports"` field with ESM entry (nodenext resolution requires explicit exports map)
- `"private": true` — example package is disposable, not published
- `"version": "0.0.1"` — starting version for the throwaway package
- Remove `"files"` (private package, no publish)

**godoo-ts target shape** (RESEARCH.md Pattern 3 package.json):
```json
{
  "name": "@godoo/example",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Throwaway proof package — deleted in Phase 2",
  "license": "LGPL-3.0",
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

---

### `packages/_example/tsconfig.json`

**Analog:** `C:/dev/odoo-toolbox/packages/odoo-client/tsconfig.json` (lines 1-9) — exact pattern match.

**Analog** (full file):
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Divergence from analog:**
- `"extends": "../../tsconfig.json"` → `"extends": "../../tsconfig.base.json"` (godoo-ts splits base config from references config)
- `"composite": true` — keep (required for project references in root tsconfig.json)
- Add `"tests"` to `"include"` so vitest can type-check test files

**godoo-ts target shape**:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src", "tests"]
}
```

---

### `packages/_example/tsdown.config.ts`

**Analog:** None — `odoo-toolbox` uses per-package `tsc` (the `"build": "tsc"` script). No tsdown config exists anywhere in the baseline.
**Source:** RESEARCH.md Pattern 3 is the sole reference.

**Target shape** (RESEARCH.md Pattern 3):
```typescript
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
})
```

---

### `packages/_example/src/index.ts`

**Analog:** `C:/dev/odoo-toolbox/packages/odoo-client/src/index.ts` (lines 1-14) — barrel export structure.

**Analog** (full file):
```typescript
export * from './client';
export * from './services';
export * from './rpc';
export * from './types';
export * from './safety';
```

**Divergence from analog:**
- The example is a throwaway single-file module, not a barrel. Structure is simpler.
- `isolatedDeclarations: true` requires **explicit return type annotations** on every export (RESEARCH.md Pitfall 3).

**godoo-ts target shape** (RESEARCH.md Code Examples):
```typescript
// Minimal example proving the toolchain works
// Explicit return type required for isolatedDeclarations
export function greet(name: string): string {
  return `Hello from godoo-ts, ${name}!`
}

export const VERSION: string = '0.0.1'
```

---

### `packages/_example/tests/index.test.ts`

**Analog:** No specific test file read; `odoo-toolbox` uses vitest for unit tests. Pattern confirmed from `vitest.config.mts` test include globs.

**Critical note:** Import path must use `.js` extension with `moduleResolution: "nodenext"` (RESEARCH.md Code Examples note).

**godoo-ts target shape** (RESEARCH.md Code Examples):
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

---

## Shared Patterns

### Monorepo workspace declaration
**Source:** `C:/dev/odoo-toolbox/package.json` lines 26-29 (npm workspaces) → replaced by `pnpm-workspace.yaml`
**Apply to:** Root config only
**Pattern:** Declare `packages/*` as workspace glob. In pnpm this lives in `pnpm-workspace.yaml`, not `package.json`.

### LGPL-3.0 license + author fields
**Source:** `C:/dev/odoo-toolbox/package.json` lines 7-8
**Apply to:** All `package.json` files (root and per-package)
```json
"author": "Marc Fargas <marc@marcfargas.com>",
"license": "LGPL-3.0"
```

### Per-package tsconfig extends pattern
**Source:** `C:/dev/odoo-toolbox/packages/odoo-client/tsconfig.json` lines 1-2
**Apply to:** Every package tsconfig in `packages/`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { ... }
}
```

### changesets access: public
**Source:** `C:/dev/odoo-toolbox/.changeset/config.json` line 7
**Apply to:** `.changeset/config.json`
```json
"access": "public"
```
Required for `@godoo/` scoped packages to publish without `--access public` flag.

### GitHub Actions checkout + setup pattern
**Source:** `C:/dev/odoo-toolbox/.github/workflows/test.yml` lines 35-49
**Apply to:** `.github/workflows/ci.yml`
```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: 'pnpm'
```
godoo-ts adds `pnpm/action-setup@v6` before `actions/setup-node@v4` (pnpm-specific requirement).

---

## No Analog Found

Files with no close match in the codebase — planner must use RESEARCH.md patterns as the sole reference:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `pnpm-workspace.yaml` | config | batch | `odoo-toolbox` uses npm workspaces in `package.json`, not pnpm-workspace.yaml |
| `biome.json` | config | batch | `odoo-toolbox` uses ESLint + Prettier; no Biome config exists |
| `packages/_example/tsdown.config.ts` | config | transform | `odoo-toolbox` uses per-package `tsc` builds; no tsdown config exists |

---

## Metadata

**Analog search scope:** `C:/dev/odoo-toolbox` root + `packages/odoo-client/` + `.changeset/` + `.github/workflows/` + `.husky/`
**Files scanned:** 9 files from `odoo-toolbox`; 0 from `godoo-ts` (empty repo)
**Baseline repo accessibility:** Confirmed accessible at `C:/dev/odoo-toolbox`
**Pattern extraction date:** 2026-05-19

### Divergence summary (odoo-toolbox → godoo-ts)

| Baseline (odoo-toolbox) | godoo-ts | Decision |
|------------------------|----------|---------|
| npm workspaces in `package.json` | pnpm workspaces via `pnpm-workspace.yaml` | D-02/D-07 |
| `"build": "tsc"` per-package | `"build": "tsdown"` per-package | D-02 |
| `"module": "commonjs"`, `"moduleResolution": "node"` | `"module": "nodenext"`, `"moduleResolution": "nodenext"` | TS 6 requirement |
| ESLint + Prettier | Biome single tool | D-03 |
| husky + lint-staged | lefthook | D-04 |
| Node 24 only CI | Node 22 + Node 24 matrix | D-05 |
| Separate setup/lint/test CI jobs | Single `ci` job | D-07 |
| `baseBranch: "master"` in changesets | `baseBranch: "main"` | D-09 |
| `@changesets/cli/changelog` | `@changesets/changelog-github` | Claude's Discretion |
| `vitest.workspace.ts` file pattern | `test.projects` in `vitest.config.ts` | vitest 4 deprecation |
