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

### Explicit installation and upgrade (local source)

After reviewing the read-only prerequisite preview and selecting an authorized
instance, use the existing module methods explicitly:

```typescript
const revision = client.modules.catalogRevision;
try {
  const result = await client.modules.installModule('project', {
    context: { lang: 'en_US' },
    maxAttempts: 3,
    retryDelayMs: 5000,
  });
  // upgradeModule('project', options) has the same result shape.
  console.log(result.state, result.changed, result.schemaInvalidated);
  console.log(result.prerequisites); // fresh installed dependency closure
} finally {
  if (client.modules.catalogRevision !== revision) {
    introspector.clearCache();
    // Obtain fresh model/field metadata and build a new resource plan.
  }
}
```

`ModuleOperationResult` extends the existing `ModuleInfo` result with `operation`,
`changed`, `schemaInvalidated`, `attempts` and fresh `prerequisites`. Installing an
already installed module is a verified no-op (`changed: false`, zero attempts).
Every visible dependency must be installed for a success result. Missing,
ambiguous, inaccessible, uninstallable, transitional or incomplete metadata fails
closed before dispatch; unexpected/authentication/network/safety errors propagate.
After dispatch, deferred/noninstalled states, changed identities or a refused or
malformed action response fail verification. This verifies observed state, not a
whole-run transaction or filesystem readiness.

Completion-response validation: accept an empty dictionary, a client
`reload`, the canonical `/web` (Odoo 17) or `/odoo` (Odoo 18) self redirect, or a
registered configuration-window
action returned by Odoo 17 `ir.actions.todo.action_launch` (positive action ID,
valid destination/view mode/target and `context.disable_log: true`). Reject module
operation models (`base.module.*` and `ir.module.module`), explicit error/refusal
markers and unsupported action shapes. A configuration window is recognized as
completion metadata only; this client never executes it. An unchanged installed version is
valid for an upgrade. Response validation complements fresh state/identity checks.

The exact Odoo 18 redirect follows
[`ir_module.next()` at upstream a2e1d43](https://github.com/odoo/odoo/blob/a2e1d43d94215dc98babd5674ca4d3956eef5c9e/odoo/addons/base/models/ir_module.py#L584-L599).
Other URL paths, query strings and targets remain unsupported. This narrow
completion contract does not certify other Odoo 18 behavior; prerequisite schema
design and the original supplier acceptance remain based on Odoo 17.

Odoo installs dependencies and may auto-install addons. Upgrade can refresh Odoo's
catalog and upgrade dependent modules internally; the client does not invoke a
separate refresh or enumerate calls to install dependencies. Inspection remains
read-only. No automatic removal is added. Existing safety guards remain active.

Only the structured Odoo 17 English cron-lock `UserError` is retried: at most
`maxAttempts` (1–5, default 3), with `retryDelayMs` (0–30000, default 5000).
Translated/unrecognized errors propagate without retry. Each retry rechecks fresh
prerequisites and the original module identities; postcondition failures never
retry. Other RPC failures may follow committed work: inspect again before deciding
whether to retry manually. `catalogRevision` increments conservatively before each
install/upgrade dispatch, including a dispatch rejected by safety or one whose
outcome is unknown. It is a per-manager invalidation signal, not a server-wide catalog
version. `schemaInvalidated: true`/`changed: true` mean a lifecycle call completed
and metadata may have changed, not proof of a schema diff. Replan after successful
lifecycle work and after uncertain failures.

This API is verified with offline fake RPC tests and available in local source and
packed artifacts; published client 0.6.1 does not contain this seam. Disposable
Odoo acceptance is a separate check. The existing explicit `uninstallModule()`
API is unchanged and is outside this installation/upgrade verification contract.

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
