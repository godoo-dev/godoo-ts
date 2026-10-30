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

**Prerequisites**: Node.js ≥ 22.18.0, an authorized Odoo18 instance.

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

The original schema design used Odoo **17.0** (historical reference)
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

### Properties

Parent-scoped bindings are available in this source checkout, unreleased.
Docker-free tests and declaration generation cover this API; installed-package
and live Odoo18 qualification remain separate delivery gates.

```typescript
const scope = await client.properties.scope('project.task', 'task_properties', {
  parentId: projectId,
  context: { lang: 'en_US' },
});
const tasks = scope.bind({
  priority: {
    label: 'Priority', type: 'selection',
    options: { high: { label: 'High' }, low: { label: 'Low' } },
  },
  estimate: { label: 'Estimated effort', type: 'float' },
} as const);
const [task] = await tasks.read([taskId]);
task.properties.priority; // 'high' | 'low' | null
console.log(scope.describe().definitions, tasks.mapping());
const receipt = await tasks.patch(taskId, { priority: 'high', estimate: 0 });
if (receipt.status !== 'acknowledged') console.log(receipt.status, receipt.error);
```

`createPropertiesScope(client, model, field, options)` is also exported and accepts
`Pick<OdooCrudClient, 'call' | 'read' | 'write'>`, including `OAuthProxyClient`.
Use IDs from records you are authorized to access. Discovery calls `fields_get`
for the properties field's `type`, `definition_record` and
`definition_record_field`, then the child relation's `type` and `relation`, and
reads the parent's definitions. For custom metadata, supply
`parent: { model, field, relation }`; `relation` must still be a child many2one to
that parent model, and every child read must belong to `parentId`.

Each scope fixes its parent, client and copied context. `describe()` returns a
detached snapshot containing the parent relationship, raw metadata and definitions.
`refresh()` reads the parent definitions again and returns a fresh description.
There is no global cache. Reads use the scope's current snapshot and validate
child-embedded definitions; mutations always refresh first. A refresh changes
discovery without rebinding existing aliases.

Each declaration uses exactly one selector, `{ label: 'Exact label' }` or
`{ id: 'technical_id' }`, plus its `type`. Labels must match uniquely; errors
include matching IDs and available IDs. Property aliases resolve once to unique
IDs. Selection and tags declarations require an `options` alias map whose
selectors follow the same rule. Relation declarations may assert `comodel`;
`mapping()` records the actual comodel even when omitted. Supported kinds are
`char`, `integer`, `float`, `boolean`, `date`, `datetime`, `many2one`, `many2many`,
`selection` and `tags`; separators cannot bind.

The returned object's exact keys and option aliases follow the validated
literal declarations. Read rows expose `{ id, properties, raw }`; `raw` retains
the server's properties array. Relation display tuples become IDs or ID arrays.
Date and datetime values remain strings. Received `false`/`null` values become
`null`, except boolean `false` stays `false`. Zero, empty strings and empty arrays
are preserved when received. Unexpected unmapped options throw
`PropertiesBindingError` with code `unmapped-option` and
`details: { recordId, propertyId, optionId }` so callers can inspect raw IDs.

Renames, reordering, colors and unrelated additions do not change resolved IDs.
Missing IDs, incompatible types/comodels and removed mapped options throw
`PropertiesBindingError` with code `stale-binding`; the API never silently
resolves labels again. Deletion and recreation using an identical ID and
compatible definition are indistinguishable. Application code must deliberately
create a new binding when changing its contract.

`patch(id, changes)` returns one receipt. `patchMany(ids, sameChanges)` and
`patchEach([{ id, changes }])` return receipts in request order. Omitted keys
stay untouched; explicit `undefined`, unknown aliases and invalid shapes are
rejected. `null` clears a scalar with `false`, and clears tags/many2many with
`[]`. Tags alias arrays replace that property. Outgoing `0`, `false`, `''` and
`[]` retain their representations in the payload. Odoo18 can collapse empty
characters, empty arrays and unset scalar/date values to `false` when flushing;
this API does not promise those empty representations round-trip.

The whole batch validates unique positive record IDs, declarations, record
presence, parent membership, embedded definitions and every raw value before any
write. A preflight failure rejects the operation with zero writes. Merged
payloads start with `propertiesToWriteFormat()` so supported unbound properties
and untouched unmapped options survive. Unsupported or malformed raw values
block replacement, including on the last record. Valid empty batches make zero
RPCs. A normal nonempty mutation makes one parent definition read, one child
read and one write per record. Scope creation separately costs two metadata
calls and one parent read. Reads and batches are not chunked.

Writes settle independently with bounded concurrency (`options.concurrency`,
default `4`). `acknowledged` means the server returned exactly `true`.
`failed` means an explicit RPC rejection or a local safety block. `unknown`
covers network/timeout/protocol errors, unexpected results and unclassified
exceptions. Failed/unknown receipts retain the original thrown value (or
unexpected result) in `error`. Both transports expose malformed RPC envelopes
as `OdooProtocolError`, including missing results and mismatched response IDs.
The properties layer does not retry writes; an unknown receipt is not a safe
retry signal.

Read/merge/write is not atomic and can lose concurrent updates. A child may move
to another parent after validation and before writing. No client lock,
`write_date` check or readback guarantee is implied. Only server-visible values
can be preserved; hidden stored JSON is inaccessible. Definition administration,
tag add/remove operations and generated contracts are outside this API.

The source property helpers normalize Odoo's many2one `[id, display_name]` values
to IDs and many2many display pairs to ID arrays
before writing. `getPropertyValue()` extracts the raw read value, including display
tuples; `propertiesToWriteFormat()` produces normalized dictionary-write values.
These changes are unreleased.

```typescript
// Keys and selection/tag values are Odoo technical identifiers.
await client.properties.updateSafely('project.task', taskId, 'task_properties', {
  priority_property_id: 'high_option_id',
});

const values = await client.properties.getCurrentWriteFormat(
  'project.task', taskId, 'task_properties',
);
```

These helpers read current values, merge the patch and replace the field. They
preserve other supported values returned by Odoo, including relational properties.
Odoo can hide stored values whose definitions were removed, and concurrent writers
can overwrite each other's updates. The helpers do not make the operation atomic.
The codec retains empty inputs and numeric zero; Odoo may normalize empty or unset
values to `false` on readback.

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
