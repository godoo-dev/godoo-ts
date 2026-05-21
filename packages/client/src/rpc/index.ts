// RPC transport layer

// Bearer-token transport for the OAuth-fronted proxy.
export { BearerJsonRpcTransport, type BearerJsonRpcTransportConfig } from './bearer-transport';
export {
  type JsonRpcRequest,
  type JsonRpcResponse,
  JsonRpcTransport,
  type OdooSessionInfo,
} from './transport';

// Odoo search-domain and positional-RPC-argument types — re-exported so
// downstream packages (@godoo/testcontainers, @godoo/introspection) can
// import them via `import type { Domain, RpcArg } from '@godoo/client'`.
export type { Domain, DomainClause, RpcArg } from './types';
