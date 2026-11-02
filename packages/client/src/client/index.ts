// Core client

export * from './bound-client';
export { configFromEnv, createClient } from './config';
// OAuth-fronted proxy client (sibling to OdooClient — same CRUD surface,
// bearer-token auth instead of common.login).
export { OAuthProxyClient, type OAuthProxyClientConfig } from './oauth-proxy-client';
export { OdooClient, type OdooClientConfig } from './odoo-client';
export { OdooClientCore } from './odoo-client-core';

// Shared CRUD contract (for OdooClient + OAuthProxyClient)
export type {
  CallOptions,
  ClientSession,
  OdooCrudClient,
  SearchOptions,
  SearchReadOptions,
  ServiceClient,
} from './types';
