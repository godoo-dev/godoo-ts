# @godoo-dev/client

Lightweight TypeScript client for Odoo RPC operations.

## Features

- `createClient()` one-liner: reads env vars, authenticates, ready to use
- CRUD operations: `searchRead`, `search`, `create`, `write`, `unlink`, `read`, `searchCount`
- Service accessors: `client.mail.*` (chatter), `client.modules.*` (module management)
- Safety guards for dangerous operations
- JSON-RPC transport with session management
- Comprehensive error types: `OdooAuthError`, `OdooNetworkError`, `OdooValidationError`

## Installation

```bash
pnpm add @godoo-dev/client
```

**Prerequisites**: Node.js ≥ 22.18.0, a running Odoo v17 instance.

## Quick Start

```typescript
import { createClient } from '@godoo-dev/client';

// Reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD from environment
const client = await createClient();

// Search
const partners = await client.searchRead('res.partner',
  [['name', 'ilike', 'John']],
  { fields: ['name', 'email'] }
);

// Create
const newId = await client.create('res.partner', { name: 'Acme Corp' });

// Update
await client.write('res.partner', [newId], { email: 'info@acme.com' });

// Delete (requires safety context)
await client.unlink('res.partner', [newId]);
```

**Environment variables** (required for `createClient()`):

```bash
export ODOO_URL=http://localhost:8069
export ODOO_DB=odoo_dev
export ODOO_USER=admin
export ODOO_PASSWORD=admin
```

## Service Accessors

### Mail (Chatter)

```typescript
// Internal note (visible only to internal users)
await client.mail.postInternalNote('res.partner', partnerId, {
  body: '<p>Customer called about invoice</p>',
});

// Public message (visible to followers including portal users)
await client.mail.postOpenMessage('res.partner', partnerId, {
  body: '<p>Your order has been shipped</p>',
});
```

### Module Management

Read-only prerequisite inspection:

The APIs below are available in this source checkout. Registry publication and
consumer acceptance require separate evidence; the package version alone does
not establish their availability in an installed release.

```typescript
const server = await client.getServerInfo();
const prerequisites = await client.modules.inspectPrerequisites(['sale', 'crm'], {
  context: { lang: 'en_US' },
});
console.log(server.version, prerequisites.modules, prerequisites.diagnostics);

// The same inspector can use any OdooCrudClient, including OAuthProxyClient.
import { inspectModulePrerequisites } from '@godoo-dev/client';
const report = await inspectModulePrerequisites(client, ['sale']);
for (const addon of report.modules) {
  console.log(addon.name, addon.status, addon.state, addon.dependencies);
}
```

Inspection reads the registered addon catalog and dependency metadata. It never
refreshes that catalog or installs, upgrades, uninstalls, or executes actions.
Missing catalog entries do not prove addon source is absent from disk. Source
availability and Python/system prerequisites remain unknown through this seam.

`getServerInfo()` calls JSON-RPC `common.version` without logging in or changing
the session. It returns `version`, `versionInfo`, `major`, `series`,
`protocolVersion`, the raw reported facts and the observed
`capabilities.jsonRpcCommonVersion`. Missing facts are `null`; it never infers
addon support from a version number. The proxy CRUD contract has no version
endpoint; `getServerInfo()` is on `OdooClient` and `JsonRpcTransport` only.

`inspectPrerequisites(names, { context? })` uses only `fields_get` and
`search_read`. Names and dependency lists are deduplicated and sorted; cycles
terminate and appear as deterministic DFS back edges in `cycleEdges`. Returned
statuses are `installed`, `uninstalled`, `missing`, `uninstallable`, `transitional`
and `unknown` or `inaccessible`. `state` preserves Odoo's exact value.
`dependencies: null` means the full list could not be established. The inspector
continues through valid visible edges when some dependency rows are hidden.
`closureComplete` concerns visible registered dependency metadata only; it does
not establish installability, readiness or a consistent transactional snapshot.

Access failures, missing metadata models and unavailable/restricted schema have
separate diagnostics with original structured errors where observable.
Addon state is read separately from dependency relations, so a denied relation
read retains the known addon ID/state and reports incomplete dependencies. Relation
diagnostics identify the requested `field` and `relatedModel` without guessing
which model's ACL caused the denial. An empty
addon search is `missing` **from the visible catalog**; record rules can silently
hide records, and this API cannot distinguish that from an absent catalog entry.
It never refreshes the catalog to resolve the ambiguity. Authentication, network,
safety and unexpected RPC errors propagate unchanged. An `uninstallable` state
does not identify the reason or establish whether source files exist.

The schema is designed against Odoo **17.0**
([upstream module metadata](https://github.com/odoo/odoo/blob/1959040e5cab026612c3ac627a838871cb4a9fce/odoo/addons/base/models/ir_module.py)).
Other versions/customizations are schema-probed, not certified by version number.
Offline mocks verify the call contract; no live compatibility claim is made here.
There is no filesystem or manifest/external-dependency check, auto-install or
exclusion policy, or resource/adoption plan. Use introspection or raw
`fields_get` separately for required custom models/fields; a missing schema or
access error does not establish that an addon source is missing. Odoo resolves
addon installation dependencies during a separately authorized installation.

```typescript
// Check if a module is installed
const hasCRM = await client.modules.isModuleInstalled('crm');

// List installed modules
const installed = await client.modules.listModules({ state: 'installed' });

// Get module info
const info = await client.modules.getModuleInfo('sale');
```

> ⚠️ `installModule()` and `uninstallModule()` are admin-only, irreversible operations.
> Never call them without explicit user confirmation.

## Advanced: Manual Client Construction

For custom configurations, use `OdooClient` directly:

```typescript
import { OdooClient } from '@godoo-dev/client';

const client = new OdooClient({
  url: 'http://localhost:8069',
  database: 'odoo_dev',
  username: 'admin',
  password: 'admin',
  context: { lang: 'en_US' },
  timeoutMs: 30000,
});
await client.authenticate();
```

## OAuth-Fronted Proxy

For deployments where Odoo sits behind an OAuth-fronted proxy (e.g. [`odoo-api-proxy`](https://github.com/marcfargas/odoo-api-proxy)), use `OAuthProxyClient` instead of `OdooClient`. Same CRUD surface, bearer-token auth instead of `common.login`:

```typescript
import { OAuthProxyClient } from '@godoo-dev/client';

const client = new OAuthProxyClient({
  proxyBaseUrl: 'https://proxy.example.com',
  getAccessToken: async () => myAuthLib.getAccessToken(),
});

const partners = await client.searchRead('res.partner', [], {
  fields: ['name', 'email'],
  limit: 10,
});
```

The `getAccessToken` callback owns caching and refresh — the client never caches and re-invokes the callback on HTTP 401 to signal a token-refresh.

Both `OdooClient` and `OAuthProxyClient` implement the shared `OdooCrudClient` interface, so application code can program against the abstraction and swap transports with only a constructor change:

```typescript
import type { OdooCrudClient } from '@godoo-dev/client';

async function syncPartners(client: OdooCrudClient) {
  return client.searchRead('res.partner', [], { fields: ['name', 'email'] });
}
```

> Service accessors (`client.mail.*`, `client.modules.*`) and the safety guard live on `OdooClient` only. `OAuthProxyClient` ships with CRUD + raw `call` in v1.

For lower-level control, `BearerJsonRpcTransport` is also exported.

## Tested Examples

Client examples and assertions live in [the package tests](tests). Odoo knowledge belongs to the separate Atlas product; this package does not bundle a knowledge skill.

## Related Packages

- [@godoo-dev/introspection](../introspection) — Schema introspection and code generation
- [@godoo-dev/testcontainers](../testcontainers) — Docker/Odoo test harness

## Bugs & Support

[GitHub Issues](https://github.com/godoo-dev/godoo-ts/issues)

## License

LGPL-3.0 — see [LICENSE](./LICENSE)
