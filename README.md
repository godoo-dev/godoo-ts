# godoo-ts

TypeScript libraries for automating Odoo through RPC, inspecting instance schemas
and running disposable Odoo test environments. LGPL-3.0; this monorepo is their
canonical source home.

| Package | Purpose | Guide |
| --- | --- | --- |
| `@godoo-dev/client` | RPC client, CRUD, safety guards and services | [Client](packages/client/README.md) |
| `@godoo-dev/introspection` | Model/field discovery, caching and type generation | [Introspection](packages/introspection/README.md) |
| `@godoo-dev/testcontainers` | Disposable Odoo/Postgres and test harness | [Testcontainers](packages/testcontainers/README.md) |

Install the packages needed by your application, for example:

```sh
pnpm add @godoo-dev/client
```

With `ODOO_URL`, `ODOO_DB`, `ODOO_USER` and `ODOO_PASSWORD` configured for an
instance you are authorized to read:

```ts
import { createClient } from '@godoo-dev/client';

const client = await createClient();
const partners = await client.searchRead('res.partner', [], {
  fields: ['name', 'email'],
  limit: 5,
});
```

The source workspace requires Node >=22.18.0 and pnpm 11.1.3. CI is configured for
Node22.18.0 and24.22.1. Odoo18 is the required baseline; later-major qualification
is manual after18 on the same packed candidate. Package versions in a checkout, registry publication and runtime
compatibility are separate evidence; this README is not a release receipt.

For contributors, start with [development](docs/development.md). The libraries
provide reusable Odoo operations; standalone desired-state reconciliation belongs
to godoo-stateman. See the local [library targets](/home/marc/dev/godoo-dev/godoo-hq/docs/libraries.md)
for portfolio intent and [AGENTS.md](AGENTS.md) for agent guidance.
