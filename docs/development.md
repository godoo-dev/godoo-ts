# Developing the TypeScript libraries

Use Node >=22.18.0 and the `pnpm@11.1.3` version declared in package.json. From the
workspace root:

```sh
pnpm install --frozen-lockfile
pnpm check
export CANDIDATE_DIR=/absolute/path/outside/checkout/new-candidate
node scripts/candidate.mjs pack "$CANDIDATE_DIR"
pnpm check:package
pnpm check:odoo18
```

`check` validates all package source and test code under strict TypeScript,
using bundler resolution to match tsdown, then builds declarations and runs units
and gate regressions. `tsconfig.check.json` includes production, tests and configs;
package configs own declaration builds. No baseline diagnostics are accepted.
The source packages have a development-only client/testcontainers cycle; the
all-source check does not depend on cyclic project-reference builds.

`check:package` installs exact tarballs in an external consumer, compiles public
APIs and generated output with NodeNext, checks import origins and runs the CLI.
The retained manifest includes versions, internal dependencies, peer dependencies,
SHA256, source content/commit/tree/patch identity, lock and tool versions. A supplied
candidate is never rebuilt. The consumer lock is prepared once, retained and then
installed frozen; internal dependencies always use the explicit candidate files.
Third-party packages still need registry/network availability on a cold cache.

`pnpm test` stays Docker-free. The11 skipped legacy example-file checks refer to
absent tutorial files and are reported separately. `pnpm test:integration:list`
proves selection across all three packages without Docker. `check:odoo18` requires
Docker, nonzero collection and fully executed integration suites, then exercises
client CRUD/readback, addon inspection, introspection and generated code through
the installed tarballs. It rejects an explicit17 before provisioning. Odoo19 is
manual via `check:odoo19`, requires18 proof for the same candidate and is not yet
qualified. Never use a business instance as a substitute.

The provisioner uses unique networks and labeled containers, loopback-only
published ports, authenticated ORM readiness and observed-major assertions. It
logs exact image/container/module identity and cleans only its own resources.
Tests use disposable databases and temporary addon directories; evidence survives
teardown outside the checkout. Do not log credentials or load private connections.
See the [verification skill](../.agents/skills/godoo-ts-verification/SKILL.md) for
failure trials and cleanup checks.

## Package structure and constraints

- `packages/client/src/client` owns authentication, client configuration and CRUD;
  `rpc` owns wire transport/errors; `services` contains higher-level Odoo operations.
  `OdooCrudClient` is the shared CRUD interface. `OAuthProxyClient` supplies bearer
  transport and raw calls; its surface does not include OdooClient service accessors
  or safety guards. The standalone `inspectModulePrerequisites()` function accepts
  the structural `call`/`searchRead` subset of `OdooCrudClient`, including
  `OAuthProxyClient`. `OdooClient.modules.inspectPrerequisites()` delegates to it.
- `packages/introspection` depends on the client. Cache freshness is explicit:
  invalidate model metadata after addon changes before planning against new fields.
- `packages/testcontainers` uses the client at runtime; the client's container tests
  depend on testcontainers during development. Preserve the unit/integration split
  when changing either package.

Keep TypeScript strict. Public exports and generated declarations must build
through tsdown, whose output uses `.mjs` and `.d.mts`. A package with a CLI needs
both library and CLI entries. Check emitted declarations as well as `tsc`; DTS
bundling can require more explicit exported types. A generated consumer file must
carry its own required type imports.

Vitest workspace projects can override root exclusions. Retain defensive package
exclusions for `*.integration.test.ts`; unit runs must not acquire Docker merely
because root configuration excludes integrations.

## Changes and distribution

Changesets describe package-facing changes. Workspace dependencies use
`workspace:*`; packing/releasing must resolve publishable versions, including peer
dependencies. Package manifests own the exact names and versions.
The version-only workflow uses Changesets on `main`; the separate release workflow
uses Node24 and npm OIDC with provenance. This describes configuration, not a verified publisher
or registry state. Publishing, branch merges and old-package deprecation require
separately authorized work. `scripts/deprecate-marcfargas.sh` is a mutating registry
tool, not a housekeeping check.

## Product boundaries

Generic server discovery, addon metadata and module-operation results belong in
the client. Resource graphs, adoption, ownership and removal policy belong in
Stateman. The [HQ library target](/home/marc/dev/godoo-dev/godoo-hq/docs/libraries.md)
records the prerequisite contract. Do not infer module-operation postconditions
from the existence of a method; verify the actual result and failure paths.

The current source provides read-only registered addon inspection:

```ts
import { inspectModulePrerequisites, type OdooCrudClient } from '@godoo-dev/client';

export async function inspectAddons(client: OdooCrudClient) {
  return inspectModulePrerequisites(client, ['sale'], { context: { lang: 'en_US' } });
}
```

It uses `fields_get` and `search_read`, preserving readable addon state when
dependency metadata is unavailable. `dependencies: null` and
`closureComplete: false` indicate incomplete dependency facts. Version facts use
`common.version` through `OdooClient.getServerInfo()` or
`JsonRpcTransport.getServerInfo()`; the proxy CRUD seam has no version endpoint.
See the [client guide](../packages/client/README.md#module-management) for results
and diagnostics. The schema was originally designed against Odoo17 and is probed per inspection; offline
checks establish the call contract, not live compatibility, filesystem source
availability, external prerequisites or a transactional snapshot. Local source
availability does not establish registry publication or Stateman acceptance.

Seeding and portable fixtures remain a product interface choice. The historical
idea of embedding Python Stateman through WASM and reducing testcontainers to
initialization is superseded by standalone TS delivery; it does not authorize
removing existing test setup capabilities.

## Integration and release controls

CI runs on all changes targeting/pushed to develop/main and manual validation.
Its stable `required` job accepts only explicit success from offline (Node22/24),
package and Odoo18 jobs, rejecting skipped, cancelled, failed and missing results.
Manual requested19 depends on successful package/Odoo18 proof for the same candidate;
`required` also waits for19 and requires success when requested, allowing its
explicit skipped result only when unrequested.
Prepared YAML and local predicate trials do not prove hosted execution or applied
branch protection. Administrators must separately configure/read back rules for
these actual job producers and any bypasses; no such settings are changed here.

Changesets remains the independent-package version convention with main as base.
Run `pnpm version-packages` locally, or use manual **Prepare versions** on main to
retain a reviewable patch. Review/commit version changes before final validation.
That entrypoint does not publish or push. The direct `pnpm release` command refuses
and points to manual **Release**, whose `publish` input defaults false.

Release first rejects ineligible/stale refs (only the fetched reviewed main head),
then calls the same full validation workflow and verifies the downloaded qualified
artifacts even when `publish` is false. Optional protected-environment
promotion downloads the exact qualified artifacts from that run, rechecks source,
metadata and SHA256/proof, and publishes those tarballs with scripts disabled.
It does not rebuild or version after proof. npm trusted-publisher/environment
protection must be provisioned/read back by the owner before any publication;
this change neither provisions nor exercises it. No automatic release or deploy
is configured. Current local candidates are unreleased, even if their version
numbers match an existing registry version.

Publication recovery must first inspect every selected npm version and compare
downloaded bytes with the retained candidate. Matching archives are retained;
only missing archives are uploaded. A collision or unavailable registry check
halts the whole selected set before another upload. This recovery does not
replace the main-line, same-run proof or publishing-access requirements.
