# Phase 2: Core-3 Adoption & Rename - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 19 destination files across 3 adopted packages + 2 modified root files
**Analogs found:** 17 / 19 (2 files have no direct analog and are flagged below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/client/package.json` | manifest | build/publish-meta | `packages/_example/package.json` | exact (shape) |
| `packages/client/tsconfig.json` | build-config | typecheck wiring | `packages/_example/tsconfig.json` | exact |
| `packages/client/tsdown.config.ts` | build-config | bundler config | `packages/_example/tsdown.config.ts` | exact |
| `packages/client/src/**/*.ts` | source | library code (RPC) | `C:\dev\odoo-toolbox\packages\odoo-client\src\**\*.ts` | exact (source copy) |
| `packages/client/tests/**/*.test.ts` | test | unit assertions | `packages/_example/tests/index.test.ts` + source tests | exact (import-style); source for content |
| `packages/client/vitest.integration.config.ts` | test-config | vitest-config | source `odoo-testcontainers/vitest.config.ts` (timeout shape) | role-match |
| `packages/client/tests/integration-setup.ts` | test-fixture | globalSetup (container) | NONE in godoo-ts; pattern from `vitest` `globalSetup` docs + RESEARCH.md §Integration-Test Reactivation | no-analog (NEW) |
| `packages/testcontainers/package.json` | manifest | build/publish-meta | `packages/_example/package.json` | exact (shape) + cross-dep extension |
| `packages/testcontainers/tsconfig.json` | build-config | typecheck wiring | `packages/_example/tsconfig.json` | exact |
| `packages/testcontainers/tsdown.config.ts` | build-config | bundler config | `packages/_example/tsdown.config.ts` | exact |
| `packages/testcontainers/vitest.config.ts` | test-config | vitest-config | source `odoo-testcontainers/vitest.config.ts` | exact (carry-over) |
| `packages/testcontainers/src/**/*.ts` | source | library code (Docker lifecycle) | source `odoo-testcontainers/src/**/*.ts` | exact (source copy) |
| `packages/testcontainers/tests/**/*.test.ts` | test | unit + integration | source tests | exact (content); `_example` for import-style |
| `packages/introspection/package.json` | manifest | build/publish-meta + bin | `packages/_example/package.json` + bin shape from RESEARCH.md | role-match (no `_example` bin precedent) |
| `packages/introspection/tsconfig.json` | build-config | typecheck wiring | `packages/_example/tsconfig.json` | exact |
| `packages/introspection/tsdown.config.ts` | build-config | bundler config (multi-entry) | `packages/_example/tsdown.config.ts` | role-match (extend `entry` array) |
| `packages/introspection/src/cli/cli.ts` (shebang prepend) | source | CLI bootstrap | source `odoo-introspection/src/cli/cli.ts` | exact + 1-line shebang |
| `packages/introspection/src/**/*.ts` (rest) | source | library + codegen | source `odoo-introspection/src/**/*.ts` | exact (source copy) |
| `tsconfig.json` (root, modified) | build-config | project references | self (existing references[]) | exact (append entries) |
| `.github/workflows/ci.yml` (modified) | CI | workflow-job | existing `ci` job in same file | exact (mirror job) |
| `vitest.config.ts` (root, modified) | test-config | vitest projects | self (existing `projects` + add `exclude`) | exact (1-line add) |
| `pnpm-workspace.yaml` (NOT modified) | config | workspace manifest | self | n/a — `packages/*` glob auto-picks up new packages |
| `packages/_example/*` (DELETED) | n/a | n/a | n/a | n/a — D-07 deletion |

## Pattern Assignments

### `packages/client/package.json` (manifest, build/publish-meta)

**Analog:** `packages/_example/package.json` (whole-file shape) + source `odoo-client/package.json` (`description`, `keywords`, `author` metadata to preserve)

**Shape pattern** (`packages/_example/package.json` lines 1-21) — copy this skeleton, swap `@godoo/example` → `@godoo/client`, drop `private`, add `description` + `dependencies` + `repository` block:

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
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.mts"
    }
  },
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "scripts": {
    "build": "tsdown",
    "test": "vitest run"
  }
}
```

**Phase-2 delta (mandatory rewrites — `packages/_example` does not show these because it is private + has no deps):**

| Field | New value for client |
|-------|----------------------|
| `name` | `@godoo/client` (drop `private: true`) |
| `version` | `0.6.0` (inherit; Phase 3 rebaselines) |
| `license` | `LGPL-3.0` (same as `_example`) |
| `repository` | `{ "type": "git", "url": "https://github.com/godoo-dev/godoo-ts.git", "directory": "packages/client" }` |
| `homepage` | `https://github.com/godoo-dev/godoo-ts/tree/main/packages/client` (optional) |
| `dependencies` | `{ "debug": "^4.4.3" }` |
| `devDependencies` | `{ "@types/debug": "^4.1.12" }` — DROP `jest`, `ts-jest`, `@types/jest`, `typescript`, `vitest` (workspace-root provides these) |
| `scripts.test` | `vitest run` (was `jest`) |
| `scripts.test:integration` | `vitest run --config vitest.integration.config.ts` (added in 02-03) |

**Critical: exports map MUST use `.mjs`/`.d.mts` (Phase-1 landmine #1).** Source repo uses `.js`/`.d.ts` — do not carry over.

---

### `packages/client/tsconfig.json` (build-config, typecheck wiring)

**Analog:** `packages/_example/tsconfig.json` (verbatim copy)

**Pattern** (full file, lines 1-10):

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

**Phase-2 delta:** Source repo's tsconfig extends `../../tsconfig.json` (the source repo's root) — rewrite to `../../tsconfig.base.json`. Source `exclude` blocks (`["dist","tests","**/*.test.ts"]` on testcontainers, `["node_modules","dist","tests"]` on introspection) — DROP. `_example` pattern includes both `src` and `tests` so test files are typechecked.

**Applies identically to:** `packages/testcontainers/tsconfig.json`, `packages/introspection/tsconfig.json`.

---

### `packages/client/tsdown.config.ts` (build-config, bundler config)

**Analog:** `packages/_example/tsdown.config.ts` (verbatim copy)

**Pattern** (full file, lines 1-9):

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
});
```

**Applies identically to:** `packages/testcontainers/tsdown.config.ts`.

**For `packages/introspection/tsdown.config.ts` — same skeleton, two-entry `entry` array:**

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts', './src/cli/cli.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
});
```

This emits `dist/index.mjs`, `dist/index.d.mts`, `dist/cli/cli.mjs`, `dist/cli/cli.d.mts` — matching the `bin: { "odoo-introspect": "dist/cli/cli.mjs" }` in the package.json.

---

### `packages/client/src/**/*.ts` (source, library code)

**Analog:** `C:\dev\odoo-toolbox\packages\odoo-client\src\**\*.ts` (plain-copy per D-01)

**Import-rewrite pattern** (3 JSDoc `@example` lines per RESEARCH.md §Import-Path Rewrite Scope):

```typescript
// BEFORE (src/client/config.ts:50, src/client/oauth-proxy-client.ts:28, src/services/index.ts:11)
import { createClient } from '@marcfargas/odoo-client';
// AFTER
import { createClient } from '@godoo/client';
```

**Strict-TS pattern** (the ~28 `any` lines in 14 files — apply uniformly):

```typescript
// BEFORE (e.g. src/rpc/types.ts)
export interface RpcCall {
  domain?: any[];
  args?: any[];
}
// AFTER — define the canonical Domain type once, reuse everywhere
export type DomainClause =
  | [string, string, unknown]
  | '&' | '|' | '!';
export type Domain = DomainClause[];
export type RpcArg = unknown;

export interface RpcCall {
  domain?: Domain;
  args?: RpcArg[];
}
```

`Domain` / `RpcArg` are re-exported from `@godoo/client`'s `src/index.ts` so 02-02 and 02-04 can import them.

**Explicit-return-type pattern (isolatedDeclarations)** — from `packages/_example/src/index.ts` lines 3 + 7:

```typescript
export function greet(name: string): string {
  return `Hello from godoo-ts, ${name}!`;
}

export const VERSION: string = '0.0.1';
```

Every public export in adopted source must carry an explicit return type or value annotation. Inferred returns will fail `pnpm tsc --noEmit` under `isolatedDeclarations: true`.

---

### `packages/client/tests/**/*.test.ts` (test, unit assertions)

**Analog:** `packages/_example/tests/index.test.ts` (import shape) + source `odoo-client/tests/*.test.ts` (content)

**Import-shape pattern** (`packages/_example/tests/index.test.ts` lines 1-2) — every adopted test must use `.js` extension on source imports under `nodenext`:

```typescript
import { describe, expect, it } from 'vitest';
import { greet, VERSION } from '../src/index.js';
```

**Phase-2 delta — bulk extension fix:** Source repo tests import without extensions (e.g. `from '../src/client/odoo-client'`). Every adopted test file MUST be rewritten to add `.js` (e.g. `from '../src/client/odoo-client.js'`). Phase-1 landmine #5; pitfall #2 in RESEARCH.md.

**Integration-test skip pattern (Plan 02-01 only — for the 10 `*.integration.test.ts` files):**

```typescript
import { describe, it, expect } from 'vitest';
// TODO(CORE-03): re-enable after @godoo/testcontainers lands (Phase 02-03)
describe.skip('OdooClient RPC integration', () => {
  // ... existing tests ...
});
```

Plan 02-03 deletes both the `.skip` suffix and the TODO comment.

---

### `packages/client/vitest.integration.config.ts` (test-config, vitest-config) — NEW in Plan 02-03

**Analog:** source `odoo-testcontainers/vitest.config.ts` (timeout shape) + RESEARCH.md §Integration-Test Reactivation

**Pattern:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.integration.test.ts'],
    globalSetup: './tests/integration-setup.ts',
    testTimeout: 600_000,
    hookTimeout: 600_000,
    sequence: { concurrent: false },
    pool: 'forks',
    fileParallelism: false,
  },
});
```

**Notes:**
- `testTimeout` / `hookTimeout` at 600s = 10 min for cold Odoo container startup (source-repo convention; verified in RESEARCH.md).
- `sequence.concurrent: false` + `fileParallelism: false` — single Odoo container shared across all integration files; running in parallel would race.
- Header `import { defineConfig } from 'vitest/config';` matches root `vitest.config.ts` line 1.

---

### `packages/client/tests/integration-setup.ts` (test-fixture, globalSetup) — NEW, NO ANALOG

**Analog:** NONE in godoo-ts (no integration tests existed in Phase 1). Pattern derived from vitest globalSetup conventions + RESEARCH.md §Integration-Test Reactivation lines 254-271.

**Pattern:**

```typescript
import { startOdoo, type StartedOdooContainer } from '@godoo/testcontainers';

let odoo: StartedOdooContainer | undefined;

export async function setup(): Promise<void> {
  odoo = await startOdoo({ modules: ['base', 'mail', 'crm'] });
  process.env.ODOO_URL = odoo.url;
  process.env.ODOO_DB_NAME = odoo.database;
  process.env.ODOO_DB_USER = 'admin';
  process.env.ODOO_DB_PASSWORD = 'admin';
}

export async function teardown(): Promise<void> {
  await odoo?.cleanup();
}
```

Preserves the existing `process.env.ODOO_URL` contract used by the 10 integration test files — no edits to test file bodies are required beyond the `@marcfargas/odoo-client` → `@godoo/client` rename and the `.js` import-extension sweep.

---

### `packages/testcontainers/package.json` (manifest, build/publish-meta + cross-dep)

**Analog:** `packages/_example/package.json` (skeleton) — extend with workspace deps.

**Phase-2 delta on top of the `_example` skeleton:**

```json
{
  "name": "@godoo/testcontainers",
  "version": "0.1.5",
  "type": "module",
  "license": "LGPL-3.0",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.mts"
    }
  },
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "scripts": {
    "build": "tsdown",
    "test": "vitest run"
  },
  "dependencies": {
    "@godoo/client": "workspace:*",
    "@testcontainers/postgresql": "^10.13.2",
    "debug": "^4.3.4",
    "dockerode": "^4.0.0",
    "testcontainers": "^10.13.2"
  },
  "peerDependencies": {
    "@godoo/client": "workspace:*"
  },
  "devDependencies": {
    "@types/debug": "^4.1.12",
    "@types/dockerode": "^3.3.23"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/godoo-dev/godoo-ts.git",
    "directory": "packages/testcontainers"
  }
}
```

**Drop from source:** `rimraf`, `typescript`, `vitest`, the `clean: "rimraf dist"` script (tsdown's `clean: true` handles it).

---

### `packages/testcontainers/vitest.config.ts` (test-config)

**Analog:** source `C:\dev\odoo-toolbox\packages\odoo-testcontainers\vitest.config.ts` (carry-over verbatim)

**Pattern (carry-over — confirmed in RESEARCH.md):**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
```

The 600s timeouts are functionally required — without them container starts time out under default 5s. Per-package config wins over the root config for this package.

---

### `packages/introspection/package.json` (manifest, build/publish-meta + bin)

**Analog:** `packages/_example/package.json` (skeleton) — `_example` has NO `bin` precedent in this repo. Bin shape derived from RESEARCH.md §Source Package Shapes.

**Bin pattern (the only file in Phase 2 with a bin entry):**

```json
{
  "name": "@godoo/introspection",
  "version": "0.2.1",
  "type": "module",
  "bin": {
    "odoo-introspect": "./dist/cli/cli.mjs"
  },
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.mts"
    }
  },
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "dependencies": {
    "@godoo/client": "workspace:*",
    "debug": "^4.4.3"
  }
}
```

**Critical pattern: bin target MUST end in `.mjs` (tsdown 0.22.0 ESM output).** Source repo's `"odoo-introspect": "dist/cli/cli.js"` must be rewritten to `.mjs`. Pair with the shebang prepended to `src/cli/cli.ts`.

---

### `packages/introspection/src/cli/cli.ts` (source, CLI bootstrap)

**Analog:** source `odoo-introspection/src/cli/cli.ts` — 12-line bootstrap calling `runCli(process.argv.slice(2))`.

**Shebang-prepend pattern (Phase-2 mandatory edit):**

```typescript
#!/usr/bin/env node
// ... existing 12 lines, unchanged ...
import { runCli } from './index.js';
// (rest of source-repo content)
```

Without the shebang, `pnpm --filter @godoo/introspection exec odoo-introspect --help` fails with `Exec format error` (RESEARCH.md pitfall #3). Verify tsdown 0.22.0 preserves the shebang in `dist/cli/cli.mjs` (`head -1 dist/cli/cli.mjs` must equal `#!/usr/bin/env node`).

---

### `tsconfig.json` (root, modified — append references)

**Analog:** self (the existing `references[]` array in `tsconfig.json` lines 1-5).

**Current state (lines 1-5):**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "files": [],
  "references": [{ "path": "packages/_example" }]
}
```

**Modification pattern:**

- **Plan 02-01:** REPLACE the `_example` reference (D-07 deletes the package) with `{ "path": "packages/client" }`.
- **Plan 02-02:** APPEND `{ "path": "packages/testcontainers" }`.
- **Plan 02-04:** APPEND `{ "path": "packages/introspection" }`.

**End state after Phase 2:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "files": [],
  "references": [
    { "path": "packages/client" },
    { "path": "packages/testcontainers" },
    { "path": "packages/introspection" }
  ]
}
```

---

### `vitest.config.ts` (root, modified — exclude integration tests)

**Analog:** self (current 8-line file).

**Modification pattern (Plan 02-01):** Add `exclude` to prevent `pnpm test` from running `*.integration.test.ts` (RESEARCH.md pitfall #4):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
  },
});
```

Default vitest exclude already covers `node_modules`/`dist` — but once `exclude` is overridden, the defaults are replaced, so they must be restated. (Verify behavior in execution; alternative: use `**/*.integration.test.ts` only and rely on `exclude` extending defaults via `extends` mechanism if vitest supports it in this version.)

---

### `.github/workflows/ci.yml` (modified — add `integration` job, widen PR triggers)

**Analog:** existing `ci` job in same file (`.github/workflows/ci.yml` lines 8-25).

**Existing `ci` job pattern (lines 8-25 — copy structure verbatim, rename + extend):**

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
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

**Plan 02-03 additions (per RESEARCH.md §Integration CI Workflow Design):**

1. Widen PR trigger surface (line 5: currently `branches: [main]` → `branches: [main, develop]`).
2. Append new `integration` job (mirror `ci` job structure):

```yaml
  integration:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test:integration
        env:
          TESTCONTAINERS_RYUK_DISABLED: 'false'
```

**Notes:**
- `pnpm build` must run before `pnpm test:integration` so the `@godoo/testcontainers` ESM output exists for `@godoo/client`'s integration tests to import (workspace symlink points at `dist/` not `src/`).
- Job name + matrix produces `integration (22)` and `integration (24)` — these must be added to the branch protection ruleset (Plan 02-03 §9). Job name typos silently make checks non-required (landmine #8).
- `TESTCONTAINERS_RYUK_DISABLED: 'false'` mirrors source-repo CI (Ryuk cleans up orphan containers).

---

### `pnpm-workspace.yaml` (NOT modified)

The `packages/*` glob in line 2 auto-picks up `packages/client`, `packages/testcontainers`, `packages/introspection` as they land. No manifest edit needed.

```yaml
packages:
  - 'packages/*'
allowBuilds:
  lefthook: true
```

If any adopted dependency tree introduces a postinstall script, `pnpm install` will prompt — add to `allowBuilds:` then (landmine #3). Run `pnpm install` early in each plan to surface this.

---

## Shared Patterns

### Pattern A: ESM exports map (.mjs / .d.mts)

**Source:** `packages/_example/package.json` lines 8-15
**Apply to:** All three adopted `package.json` files (client, testcontainers, introspection)

```json
"exports": {
  ".": {
    "import": "./dist/index.mjs",
    "types": "./dist/index.d.mts"
  }
},
"main": "./dist/index.mjs",
"types": "./dist/index.d.mts"
```

**Rationale:** tsdown 0.22.0 emits `.mjs`/`.d.mts` — not `.js`/`.d.ts`. Source-repo `package.json` files all use `.js`/`.d.ts`; carrying them over breaks the exports map (Phase-1 landmine #1, auto-fix #2 from 01-VERIFICATION.md).

---

### Pattern B: Per-package tsconfig (composite + extends + include both src/tests)

**Source:** `packages/_example/tsconfig.json` (all 10 lines)
**Apply to:** All three adopted `tsconfig.json` files

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

**Critical:** Source-repo tsconfigs extend `../../tsconfig.json` and apply `exclude` to tests — both must be DROPPED. Tests must be typechecked under the strict workspace config.

---

### Pattern C: tsdown ESM-only build

**Source:** `packages/_example/tsdown.config.ts` (full file)
**Apply to:** client + testcontainers verbatim; introspection extends `entry` array

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  platform: 'node',
});
```

`clean: true` replaces any source-repo `clean` scripts; drop `rimraf` devDep when present.

---

### Pattern D: Test import style (vitest + .js extension)

**Source:** `packages/_example/tests/index.test.ts` lines 1-2
**Apply to:** Every adopted test file across all three packages

```typescript
import { describe, expect, it } from 'vitest';
import { thing } from '../src/path/to/thing.js';   // .js NOT .ts and NOT extensionless
```

**Bulk-rewrite required:** Source-repo tests omit the extension (`from '../src/client/odoo-client'`). Under `nodenext` resolution, missing extension fails `pnpm tsc --noEmit` (landmine #5; pitfall #2).

---

### Pattern E: Strict-TS — explicit return types + zero `any`

**Source:** `packages/_example/src/index.ts` lines 3 + 7; `biome.json` lines 25-27; `tsconfig.base.json` line 10
**Apply to:** All adopted source files

```typescript
// Pattern: explicit return type on every public export
export function foo(x: string): string { return x; }
export const BAR: string = 'baz';

// Pattern: replace `any[]` with a typed Domain / RpcArg
type Domain = Array</* see client/src/rpc/types.ts after rename */>;
function rpcCall(domain: Domain, args: unknown[]): unknown { /* ... */ }
```

Workspace enforces this via `biome.json` (`suspicious.noExplicitAny: error`, `correctness.noUnusedVariables: error`) and `tsconfig.base.json` (`isolatedDeclarations: true`, `noUncheckedIndexedAccess: true`, `strict: true`). D-03 forbids `// @ts-expect-error`, `// @ts-nocheck`, and `biome-ignore` — must fix properly.

---

### Pattern F: Cross-package workspace dep

**Source:** RESEARCH.md §Toolchain Conversion Delta
**Apply to:** `packages/testcontainers/package.json` (dep + peerDep) and `packages/introspection/package.json` (dep)

```json
"dependencies": {
  "@godoo/client": "workspace:*"
}
```

Plus testcontainers retains `peerDependencies: { "@godoo/client": "workspace:*" }` (changesets resolves to concrete version range at Phase-3 publish).

---

### Pattern G: Source-import rewrite `@marcfargas/odoo-*` → `@godoo/*`

**Source:** RESEARCH.md §Import-Path Rewrite Scope (exhaustive file lists)
**Apply to:** All source + test files in all three packages

```typescript
// BEFORE
import { OdooClient, ModuleManager } from '@marcfargas/odoo-client';
// AFTER
import { OdooClient, ModuleManager } from '@godoo/client';
```

Touched files (per RESEARCH.md exhaustive listing):
- client: 3 JSDoc-only refs (src/client/config.ts:50, src/client/oauth-proxy-client.ts:28, src/services/index.ts:11) + 5 README + package.json
- testcontainers: 1 real import (src/odoo-container.ts:11) + 2 JSDoc (harness.ts:50, types.ts:111) + README + package.json
- introspection: 4 real imports (src/cli/index.ts:28, src/codegen/generator.ts:11, src/introspection/introspect.ts:12, tests/examples.integration.test.ts:6) + JSDoc + README + package.json

CORE-05 verifier: `git grep "@marcfargas/odoo-"` must return zero matches in `packages/` after Phase 2. Recommendation: delete inherited `CHANGELOG.md` per package (Phase 3 regenerates via changesets).

---

### Pattern H: pnpm install — lockfile commit discipline

**Source:** User global rule `lockfile-discipline.md`
**Apply to:** Every plan that touches any `package.json`

After any `package.json` write, run `pnpm install` and stage `pnpm-lock.yaml` in the same commit. CI uses `pnpm install --frozen-lockfile`; out-of-sync lockfiles fail CI even when local tests pass.

---

## No Analog Found

| File | Role | Data Flow | Reason | Pattern source instead |
|------|------|-----------|--------|------------------------|
| `packages/client/tests/integration-setup.ts` | test-fixture | globalSetup | No integration tests existed in Phase 1; `_example` has none. The source repo's `tests/helpers/globalSetup.ts` is workspace-level and uses `testcontainers` directly (not `@godoo/testcontainers` per D-05). | RESEARCH.md §Integration-Test Reactivation lines 254-271 (full template) + vitest globalSetup API |
| `packages/introspection/package.json` `bin` field | manifest sub-field | bin shim | `_example` has no `bin` — no in-repo precedent. Source repo's `bin` points at `.js` and must be rewritten to `.mjs` for tsdown's ESM output. | RESEARCH.md §Source Package Shapes (introspection `bin` row) + Phase-1 landmine #1 (.mjs over .js) |

Both are documented in RESEARCH.md with concrete templates the planner can lift verbatim — the absence of an in-repo analog is informational, not a blocker.

---

## Metadata

**Analog search scope:**
- `packages/_example/` — full directory (canonical reference)
- root configs: `tsconfig.base.json`, `tsconfig.json`, `biome.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `package.json`
- `.github/workflows/ci.yml`
- `.planning/phases/01-repo-toolchain-bootstrap/01-VERIFICATION.md` (Phase-1 inventory)
- `.planning/phases/02-core-3-adoption-rename/02-CONTEXT.md` + `02-RESEARCH.md`
- Source packages at `C:\dev\odoo-toolbox\packages\odoo-{client,testcontainers,introspection}\` (read-only via RESEARCH.md transcription)

**Files scanned:** 11 in-repo + 3 source-repo shape tables in RESEARCH.md

**Pattern extraction date:** 2026-05-21

**Key cross-cutting observations:**
1. **`packages/_example` is the sole in-repo analog for all three adopted packages' build scaffolding.** Every `package.json` / `tsconfig.json` / `tsdown.config.ts` lifts its shape from `_example`. D-07 deletes `_example` in the first adoption commit because the new packages exercise the toolchain from then on.
2. **Strict-TS pass is the largest unknown** — the `Domain`/`RpcArg` typing in `@godoo/client` (Plan 02-01) is reused by testcontainers (02-02) and introspection (02-04). Define once in `@godoo/client`, re-export, import.
3. **`integration-setup.ts` and the `bin` field are the only no-analog patterns** — both have concrete templates in RESEARCH.md ready for the planner.
4. **Three Phase-1 landmines dominate file-content choices:** `.mjs`/`.d.mts` over `.js`/`.d.ts` (Pattern A); `.js` extension on test imports under nodenext (Pattern D); shebang on `src/cli/cli.ts` for the bin.

## PATTERN MAPPING COMPLETE
