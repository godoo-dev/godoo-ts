# @godoo-dev/client

## 0.7.0

### Minor Changes

- [#4](https://github.com/godoo-dev/godoo-ts/pull/4) [`eb727b4`](https://github.com/godoo-dev/godoo-ts/commit/eb727b4804e9b3c563a7ff232b494222fdca3aa4) Thanks [@marcfargas](https://github.com/marcfargas)! - Add read-only registered addon prerequisite inspection through the shared CRUD
  contract, including OAuthProxyClient, and server-reported version facts on
  OdooClient and JsonRpcTransport. Preserve readable addon state when dependency
  metadata access is denied, with explicit incomplete-closure diagnostics.

### Patch Changes

- [#4](https://github.com/godoo-dev/godoo-ts/pull/4) [`3f6875b`](https://github.com/godoo-dev/godoo-ts/commit/3f6875b36bd8237251644669fa7dbe54934d9804) Thanks [@marcfargas](https://github.com/marcfargas)! - Recognize Odoo 18's exact `/odoo` self-redirect as module lifecycle completion,
  alongside Odoo 17's `/web`. Keep refusal validation, installed dependency closure
  and module identity checks unchanged; reject other URL paths and targets.

- [#4](https://github.com/godoo-dev/godoo-ts/pull/4) [`c970aff`](https://github.com/godoo-dev/godoo-ts/commit/c970aff0cb6de7e778ef644f319c78055800ecb6) Thanks [@marcfargas](https://github.com/marcfargas)! - Repair strict record/error handling and generated TypeScript, default disposable
  provisioning to Odoo18, and bind owned test services to loopback with checked cleanup.

- [#4](https://github.com/godoo-dev/godoo-ts/pull/4) [`ed49f65`](https://github.com/godoo-dev/godoo-ts/commit/ed49f65b750efe1014870f4b0ff932853e52ad3d) Thanks [@marcfargas](https://github.com/marcfargas)! - Verify explicit module installation/upgrade prerequisite closure and installed
  postconditions. Preserve compatible ModuleInfo results while exposing lifecycle
  results and conservative schema invalidation; retry only bounded, classified Odoo
  17 cron-lock contention. Keep dependency inspection read-only and dependency
  installation with Odoo.

## 0.6.1

### Patch Changes

- [#1](https://github.com/godoo-dev/godoo-ts/pull/1) [`78af887`](https://github.com/godoo-dev/godoo-ts/commit/78af887ff78bfbebfd2d019199619795640ae40d) Thanks [@marcfargas](https://github.com/marcfargas)! - Renamed from `@marcfargas/odoo-client`. Migrate by replacing `@marcfargas/odoo-client` with `@godoo-dev/client` in your `package.json`.
