# Portable SDK and effect contracts

Source API contract for issue #29. Package and runtime evidence are recorded
separately in the issue; this guide does not assert publication.

Use the native SDK inside a runtime that receives an authorized model-RPC
capability from its host. The host selects the target, authenticates, applies
policy and records every RPC. Submitted code receives neither credentials nor
network configuration.

```ts
import { createBoundClient } from '@godoo-dev/client/portable';
import { Introspector } from '@godoo-dev/introspection/portable';
import { generateModelInterface } from '@godoo-dev/introspection/formatters';

// rpc is an injected capability, implemented and authorized by the host.
const client = createBoundClient({ rpc, session: { uid: 7 } });
const contacts = await client.searchRead('res.partner', [], { fields: ['name'] });
const introspector = new Introspector(client);
const metadata = await introspector.getModelMetadata('res.partner');
const declaration = generateModelInterface(metadata);
```

The bound client shares CRUD encodings, services, synchronous accessors, caches,
property scopes/bindings and async iterators with the direct client. Optional
public identity and server snapshots support helpers without authentication.
Snapshots are detached from caller input. A bound client has no login operation
or target selector. Its legacy SDK safety callbacks are convenience checks;
changing them never grants host authority.

## Portable package boundaries

`@godoo-dev/client/portable` excludes environment loading and network transports.
`@godoo-dev/introspection/portable` exposes runtime introspection and its cache.
`@godoo-dev/introspection/formatters` exposes pure string generators and field
type mapping. The existing package roots and CLI retain their Node behavior.
Portable builds must exclude Node builtins transitively, including logging.
They require standard ES2022 objects, promises and async iterators, plus
`structuredClone`, `URLSearchParams` and timers for the helpers that use them.
Runtime-specific polyfills and sandbox isolation belong to the embedding host.

## Effects at the host boundary

The `@godoo-dev/client/effects` contract uses versioned sets of effects
for reads, mutations, destruction, external actions/notifications, module/schema
changes, capability disclosure and unknown behavior. Composition takes the union;
it cannot erase a stronger effect. Pure/local helpers have no server effect.
Library helper declarations describe library behavior, not server authorization.

A generic/custom method is unknown and potentially destructive, external and
schema-changing. Familiar names such as `read` also remain unknown without a
trusted declaration for the effective implementation on that target. Hosts may
provide complete model/method declarations and additive addon contributions.
An unreviewed override must restore unknown status; absence of an addon entry is
not evidence that no override exists. Guest code cannot attest completeness.

The host resolves every actual model RPC using its own trusted declarations and
combines that result with relevant helper effects. Guest `safetyLevel` options,
helper names and mutable legacy read-method sets do not enter this decision.
Internal notes may notify; portal URL helpers may generate and disclose access
tokens; module operations may change schema and uninstall may destroy data.

## Reference and acceptance

Package-owned versioned reference exports and emitted TypeScript declarations
let an embedding application expose API information progressively. SDK reference
data does not implement MCP tools, artifact receipts, policies or approvals.

Source tests, exact installed tarballs, disposable Odoo18 behavior, actual target
ACLs and hosted MCP acceptance are separate claims. Qualification must exercise
the actual bound API, native property bindings, introspection Maps/cache and
nonempty CDC pagination. No package publication or MCP acceptance follows from a
source change. Stateman is outside this initial contract.


## Host effect example

```ts
import {
  composeEffects,
  getHelperEffects,
  resolveRpcEffects,
  type RpcEffectManifest,
} from '@godoo-dev/client/effects';

// The host loads this from its reviewed, current target declaration set.
// This example does not attest any real Odoo instance.
const effective: RpcEffectManifest = {
  schemaVersion: 1,
  source: 'reviewed-target-revision',
  declarations: [{ model: 'res.partner', method: 'read', effects: ['read'] }],
};
const effects = composeEffects(
  getHelperEffects('client.read').effects,
  resolveRpcEffects('res.partner', 'read', { effective, addons: [] }),
);
// Host policy evaluates effects before forwarding the actual model RPC.
```

Manifest entries match exact model/method names. A complete effective declaration
belongs in `effective`; addon contributions belong in `addons` and only add
effects. Missing effective coverage, invalid input or an explicit `unknown`
contribution resolves to all effects. Guest code cannot select the host's trusted
inputs. Library helper IDs and progressive sections are available through
`@godoo-dev/client/reference`; the package README and declarations are shipped
with each candidate. Reference schema 1/revision `portable-v1` and effect schema 1
identify these formats; exact package hashes identify the delivered revision.
