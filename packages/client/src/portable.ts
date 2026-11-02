/** Native SDK without environment configuration or network/authentication transports. */
export * from './client/bound-client';
export { OdooClientCore } from './client/odoo-client-core';
export type {
  CallOptions,
  ClientSession,
  OdooCrudClient,
  SearchOptions,
  SearchReadOptions,
  ServiceClient,
} from './client/types';
export type { Domain, DomainClause, RpcArg } from './rpc/types';
export * from './safety';
export * from './services';
export * from './types';
