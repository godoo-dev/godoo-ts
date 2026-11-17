---
name: godoo-ts-verification
description: Check a godoo-ts change with pnpm check, and run the slower packed-package and disposable Odoo18/19 tiers when a change touches what they cover. It does not publish packages or touch business Odoo instances.
---

# Verify godoo-ts

Use Node 22.18+ or 24 and the pnpm version pinned in `package.json` (through
corepack). Run commands from the checkout root.

## Default check

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs Biome, strict `tsc` over all package source and tests, tsdown
builds, the Docker-free Vitest suite and the CI/release control tests. Its exit
status and output are the result. CI runs it on every PR to `main` on
GitHub-hosted Ubuntu with Node 22.18.0 and 24.22.1, then the package and Odoo18
tiers on the Node 24 build artifact; the `required` job aggregates them. Run the full check locally once only
when no CI run will happen.

Focused commands while iterating:

```sh
pnpm lint              # Biome; pnpm lint:fix to apply fixes
pnpm typecheck
pnpm exec vitest run packages/client/tests/FILE.test.ts
pnpm check:controls    # CI and release control scripts
```

There is no blocking complexity rule yet; adding one is tracked as an owner
decision in the GitHub issues. Until then, keep new functions small and
refactor ones you make harder to follow.

## Slow tiers

Run these when the owner asks or the change touches what they cover. CI runs
both on every PR anyway, so locally they are for iteration.

**Packed packages** (exports, package metadata, CLI, generated types):

```sh
pnpm build
export CANDIDATE_DIR=/abs/path/outside/checkout/new-dir
node scripts/candidate.mjs pack "$CANDIDATE_DIR"
pnpm check:package
```

This installs the three tarballs into a fresh consumer, compiles the public API
and generated types, loads the portable entrypoints in an isolated VM and runs
`odoo-introspect --help`.

**Disposable Odoo18** (RPC behaviour, testcontainers, introspection against a
real server). Needs a reachable local Docker; a `docker info` failure is a
failure, not a skip.

```sh
pnpm test:integration:list   # show selected integration files, no Docker
pnpm check:odoo18            # after check:package on the same CANDIDATE_DIR
```

It runs every package's integration suites, then exercises the installed
tarballs against a fresh Odoo18. It fails on zero collected tests, skips or
pending tests.

**Odoo19** is manual: `pnpm check:odoo19` after a passing Odoo18 run on the same
candidate, or CI's `workflow_dispatch` with `qualify19`. Odoo 17 is not
supported and is rejected.

## Cleanup

Provisioning creates a uniquely named Docker network and labelled Odoo and
Postgres containers on ephemeral loopback ports, and removes them in teardown.
If a run is killed, remove only that run's containers and network by their
labels or the IDs on the run's `GODOO_ODOO_PROOF` log line. Never prune
Docker globally or stop unrelated containers. Delete the `CANDIDATE_DIR` when
done.

## Boundaries

Never point tests at a business Odoo instance or load private connection
settings. Verification does not publish, push or change repository settings.
Release runs only through the manual **Release** workflow described in
`docs/development.md`.
