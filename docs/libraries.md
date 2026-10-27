# TypeScript library targets

godoo-ts and godoo-py provide the same useful Odoo capabilities through idiomatic
TypeScript and Python APIs. Parity means equivalent outcomes with explicit
exceptions; it does not require matching method names or implementation designs.
These are targets, not a current release matrix. This repository owns the TS
contract; [godoo-py](https://github.com/godoo-dev/godoo-py) owns Python behavior.
See the [public family orientation](https://github.com/godoo-dev/.github/blob/main/profile/README.md)
for sibling boundaries. These targets were retained from the library target
reviewed on 27 October 2026; dated verification below remains reported evidence,
not a fresh test or registry receipt.

## Supported Odoo baseline

Odoo 18 is the default and required first test target. Odoo 17 is no longer an
active support or integration-test target. Verify later majors after the Odoo 18
suite passes, retaining version-specific results and explicit unsupported behavior.
Disposable Odoo/PostgreSQL integration tests exercise real server behavior;
they do not establish customer-instance or business acceptance.

## Client

- Authenticate and execute supported Odoo RPC operations with clear transport and
  structured failure behavior.
- Offer ergonomic record operations, domains, context, pagination and relations.
- Support instance-specific typing without losing access to dynamic/custom models.
- Make permission limits and unsupported operations visible to callers.

## Chatter body formats

The canonical working checkout has uncommitted TS mail changes exposing
`bodyIsHtml`, defaulting to true to preserve HTML callers; explicit false requests
literal text through Odoo's native escaping. This is pending source work, absent
from this migration's clean committed baseline, and is not a publication claim.
Python uses `body_is_html`; matching option names are not a parity requirement.
Client helpers do not interpret Markdown; callers own conversion.

The [operational MCP](https://github.com/godoo-dev/godoo-mcp-server) owns
`body_format="md"|"html"|"txt"` on `mail_log_note` and `mail_post_message`, with
Markdown as its target default. Its working-source account reports conversion to
basic Odoo-compatible HTML, escaped literal text and preservation of explicit HTML
mention attributes. Odoo still sanitizes stored HTML. Formatting changes neither
recipients nor retry authority after an uncertain write.

The retained 27 October account reports local source/package checks and disposable
Odoo18 readback for MCP formatting, legacy HTML and mention attributes, including
Odoo's internal-user permission and sanitization limits. This migration has not
rerun those checks and establishes no publication, deployment or email delivery.
No legacy post-then-write fallback is planned; Odoo18 remains the baseline.

## Stateman prerequisites

The TS Stateman delivery uses existing client CRUD/raw `call`, structured errors
and per-client safety guards. Keep ownership/adoption and resource ordering in
Stateman. Add generic capabilities to the client when they are reusable:

- Expose read-only server-version/capability discovery. The current session shape
  contains UID/session/database, so session authentication alone is not a version
  check. Keep the implementation at the transport/client boundary.
- Expose addon dependency metadata and transitive prerequisite inspection from the
  target Odoo instance, including unavailable/uninstallable/transitional states.
  Read-only inspection must not call module-list refresh/install methods. Report
  access denial separately from a missing module; remote APIs cannot install addon
  source or third-party system/Python dependencies that are absent on the server.
- Make module install/upgrade/uninstall results enforce their documented
  postconditions. Surface refusal, incomplete states and RPC failures; keep lock
  retries bounded and specific. Odoo resolves its addon installation dependencies.
- Retain safety-error propagation and context/relational-command pass-through.
  Generic XML-ID read helpers can be factored out when needed; raw CRUD already
  supports `ir.model.data`. Adoption and ownership policies stay in Stateman.

The local TS client now exposes `getServerInfo()`,
`modules.inspectPrerequisites(names, { context })` and the structural-client
`inspectModulePrerequisites` function; see the
[client API guide](../packages/client/README.md). Inspection uses
`fields_get`/`search_read`, keeps readable addon state when dependency access is
denied, and reports incomplete closure explicitly. Verification must establish
these contracts on Odoo 18. Remote inspection does not establish catalog freshness,
unfiltered visibility, addon source availability or external prerequisites.

Stateman consumes the structural inspector and validates required models/fields
against fresh metadata. The local client also hardens explicit install/upgrade:
complete installed closure and stable identities are verified, classified cron-lock
retries are bounded, and refusal/deferred responses fail. `catalogRevision` changes
before dispatch so callers invalidate schema even after ambiguous failure. This
work does not harden uninstall. These client contracts are included in
[`@godoo-dev/client@0.7.0`](https://github.com/godoo-dev/godoo-ts/releases/tag/%40godoo-dev/client%400.7.0),
published and verified through a fresh npm installation on 25 October 2026.
Odoo owns dependency installation and internal upgrade effects; remote facts do
not prove addon source
or external prerequisite availability.

The local client also recognizes Odoo 18's exact `/odoo` self-redirect after
explicit module install/upgrade, retaining installed
closure, identity and refusal checks. Pinned upstream source, offline regressions
and the consumer's guarded install/upgrade on disposable Odoo 18 verified the
replacement artifacts on 23 October 2026. This narrow contract does not certify
other Odoo 18 behavior. The portfolio target also makes Odoo 18 Stateman's default;
broader acceptance and any later-version qualification remain separate evidence.

## Introspection

- Discover model and field metadata from the actual instance.
- Generate useful language-native types/models, including selection and relation
  information, through a practical developer workflow.
- Make cache freshness and explicit refresh behavior clear. After addon changes,
  invalidate metadata and re-introspect before validating or planning resources.
  Existing TS `clearCache`/`clearModelCache` can support that integration.

## Testcontainers

- Start disposable Odoo/Postgres environments, wait for readiness, install selected
  modules and clean up resources reliably.
- Support custom addons, configuration and reusable snapshots with explicit
  invalidation/restore semantics.
- Provide a composable test harness and a practical way to seed test data/state.

Keep ordinary data conveniences in testcontainers. For declarative state, call
[Stateman's fixture/seeding interface](https://github.com/godoo-dev/godoo-stateman/blob/develop/docs/fixtures.md) after
readiness; testcontainers does not depend on Stateman. Bounded rendered desired
state replaces an earlier live snapshot smoke path. Python callers
use the installed CLI with JSON files and checked subprocess status; no second
engine or cross-language testcontainer parity is implied. Testcontainer startup
and cleanup retain their existing owner and API.

The owning libraries document their APIs, supported Odoo versions, accepted
divergences and verified behavior. Current source, package contents and execution
results are separate evidence; this page makes no blanket parity or release claim.
