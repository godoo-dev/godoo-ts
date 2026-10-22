# Developing the TypeScript libraries

Use Node >=22.18.0 and the `pnpm@11.1.3` version declared in package.json. From the
workspace root:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

`pnpm test` is the default unit suite. Docker integration is a separate opt-in
workflow: `pnpm test:integration`. It starts disposable Odoo/Postgres through
testcontainers; do not use business instances as a substitute. Client integration
setup owns the shared container lifecycle and injects its test connection values.
Never log credentials or load private connection files for documentation checks.

## Package structure and constraints

- `packages/client/src/client` owns authentication, client configuration and CRUD;
  `rpc` owns wire transport/errors; `services` contains higher-level Odoo operations.
  `OdooCrudClient` is the shared CRUD interface. `OAuthProxyClient` supplies bearer
  transport and raw calls; its surface does not include OdooClient service accessors
  or safety guards.
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
`.github/workflows/release.yml` configures Changesets on `main`, Node 24 and npm OIDC
with provenance. This describes repository configuration, not a verified publisher
or registry state. Publishing, branch merges and old-package deprecation require
separately authorized work. `scripts/deprecate-marcfargas.sh` is a mutating registry
tool, not a housekeeping check.

## Product boundaries

Generic server discovery, addon metadata and module-operation results belong in
the client. Resource graphs, adoption, ownership and removal policy belong in
Stateman. The [HQ library target](/home/marc/dev/godoo-dev/godoo-hq/docs/libraries.md)
records the prerequisite contract. Do not infer module-operation postconditions
from the existence of a method; verify the actual result and failure paths.

Seeding and portable fixtures remain a product interface choice. The historical
idea of embedding Python Stateman through WASM and reducing testcontainers to
initialization is superseded by standalone TS delivery; it does not authorize
removing existing test setup capabilities.
