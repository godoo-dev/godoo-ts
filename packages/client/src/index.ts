// Core client, config, and factory
export * from './client';
// RPC transport
export * from './rpc';
// Canonical Odoo search-domain and positional-RPC-arg types — re-exported
// at the package root so downstream `@godoo-dev/*` packages can do
// `import type { Domain, DomainClause, RpcArg } from '@godoo-dev/client'`.
export type { Domain, DomainClause, RpcArg } from './rpc/types';
// Safety guards
export * from './safety';
// Module services (mail, modules, etc.)
export * from './services';
// Types and errors
export * from './types';
