---
name: godoo-ts-verification
description: Verify godoo-ts source/tests, installed package APIs and CLI, and owned disposable Odoo18 behavior. Use for library changes or candidate qualification; it does not publish packages or verify business instances.
---

# Verify the TypeScript supplier

Resolve this checkout from the skill's repository root, read `AGENTS.md` and
`docs/development.md`, and inspect HEAD, status and linked worktrees before acting.
Use this checkout's pnpm commands; never mutate another checkout or substitute a
business instance. Work placement follows [godoo-ts-capture](../godoo-ts-capture/SKILL.md);
evidence follows owner-paths. Do not publish, push, use credentials or change
remote rules as a verification side effect.

## Offline and installed package boundary

From the repository root, with Node22.18.0 or24.22.1 and pnpm11.1.3:

```sh
pnpm install --frozen-lockfile
pnpm check
```

`check` runs Biome, strict checking of all three packages' source **and tests**,
tsdown declaration builds, the Docker-free unit suite and gate regressions.
Source checking uses bundler resolution to match tsdown; installed consumers also
compile the emitted public declarations under NodeNext. The existing skipped
example-file meta-suite is reported separately; it is not service acceptance.

Choose a new absolute evidence directory outside this checkout, following the
owner's destination. Export `CANDIDATE_DIR` to that directory, then:

```sh
node scripts/candidate.mjs pack "$CANDIDATE_DIR"
pnpm check:package
```

Pack only after the build. Packing refuses an existing manifest. Package validation
never rebuilds a supplied candidate. It checks each tarball's SHA256, metadata and
exact internal dependencies, installs all three explicit file artifacts in a fresh
external consumer, freezes/reuses its retained lock, checks real import origins,
compiles public API/generated types, and executes `odoo-introspect --help`.
All internal overrides point to the candidate files; registry resolution is only
for third-party dependencies. Inspect `manifest.json`, `consumer-lock.yaml` and
`package-proof.json`; package version text alone is not candidate identity.

## Owned disposable service proof

Docker must be reachable locally; `docker info` failure is a required-check failure.
The entrypoint rejects17 and conflicting `ODOO_VERSION` before provisioning.
Omit that variable for the18 default. List exact integration selection without
starting services:

```sh
pnpm test:integration:list
```

Then run the actual delivery caller on the same packed candidate:

```sh
pnpm check:odoo18
pnpm check:controls
```

The caller verifies candidate identity and prior installed proof, enumerates every
integration file in client/testcontainers/introspection, and rejects zero
collection, missing files, failed tests, pending tests and skipped execution. It
runs those source suites and then starts Odoo through the **installed** tarballs.
It checks version, client CRUD and independent readback, addon prerequisites,
introspection/cache refresh, generated TypeScript compilation and CLI exports.

Provisioning owns a unique Docker network and labeled Odoo/Postgres containers.
Published ports bind127.0.0.1 with ephemeral host ports. No reusable business data
or host credentials are needed. Authentication readiness and observed server major
are checked before use. `GODOO_ODOO_PROOF` logs image IDs/digests, requested/observed
version, modules, ports and exact container/network IDs. Integration fixtures use
cold disposable databases; snapshot logic has separate unit coverage. Addon mount
tests create and remove their own temporary directories.

Cleanup runs in teardown/finally for success and failure. Inspect retained logs and
query only recorded run labels/IDs to confirm cleanup; never prune Docker globally
or stop an unrelated container. If the runner is killed, use recorded IDs and
ownership labels to remove only that run's remnants. Retain proof outside temporary
consumer directories, which are deleted in finally. A listening port is not proof
of authenticated ORM readiness.

A successful18 run writes per-package collection/test JSON,
`installed-odoo18-proof.json`, generated schema and `odoo18-proof.json`. Inspect
counts/skips and runtime identity, not just exit zero. Missing Docker, unexpected
major, schema/codegen errors or teardown leaks remain failures with exact evidence.

## Rejection, release boundary and upkeep

`pnpm check:controls` exercises the real required-result caller against success,
failure, skipped, cancelled and missing dependencies; it rejects17, ineligible
promotion refs and19-before18, wrong source and altered tarball bytes using isolated
fixtures. For the actual candidate, run
`node scripts/negative-candidate.mjs "$CANDIDATE_DIR"`: it exercises the real
package/Odoo callers with isolated wrong-source/altered-byte copies, missing18
proof and an unavailable Docker socket, retaining rejection transcripts. It starts
no containers and leaves the supplied candidate's tarballs unchanged.
For changes to strict checking, use an isolated
copy to introduce a production type error and a test type error separately, invoke
`pnpm typecheck`, require the intended diagnostic, restore, and require a pass.
The maintained helper is `node scripts/negative-typecheck.mjs`; set
`NEGATIVE_EVIDENCE` to the desired external JSON filename and retain its log too.

Odoo19 qualification is explicit `pnpm check:odoo19`, after successful18 on the
same source/tarballs/consumer lock. CI's manual19 job depends on package/Odoo18
success, and `required` waits for it: requested19 must succeed; unrequested19 must
be explicitly skipped. Failure, cancellation or missing requested results fail
the aggregate.19 is unqualified until actually run.

CI owns `required` with explicit success for offline/package/odoo18 and the
request-sensitive19 result above. Changesets
version preparation is separate from manual Release validation. `publish` defaults
false; promotion requires reviewed main, that run's full validation, hash checks
and the protected npm environment, and consumes the tested tarballs without a
build. Local gate trials prove predicates, not hosted CI, applied branch rules,
trusted-publisher configuration or publication. Keep those claims separate.

After interfaces/toolchains change, compare this skill, check scripts, CI callers,
package boundaries and meaningful regressions against actual behavior. Repair
harness drift within authorized scope; preserve product failures and expectations.
Report exact SHA/tree/dirty identity, commands/exits, tests/skips, tarball manifest,
cleanup and unexecuted surfaces. The owning TS maintainers keep these controls;
remote protection/publishing settings remain owner-admin work.
