/** Direct authenticated Odoo client over the shared native SDK implementation. */

import type { OdooServerInfo } from '../rpc/server-info';
import { JsonRpcTransport, type OdooSessionInfo } from '../rpc/transport';
import type { RpcArg } from '../rpc/types';
import type { SafetyContext } from '../safety';
import { OdooAuthError } from '../types/errors';
import { OdooClientCore } from './odoo-client-core';

export interface OdooClientConfig {
  url: string;
  database: string;
  username: string;
  password: string;
  /**
   * Opt-in safety context for this client.
   * - undefined: use global default (setDefaultSafetyContext)
   * - null: explicitly disable safety for this client
   * - SafetyContext: custom confirm callback
   */
  safety?: SafetyContext | null;
}

/** Direct transport, authentication and full native SDK services. */
export class OdooClient extends OdooClientCore {
  private config: OdooClientConfig;
  private transport: JsonRpcTransport;
  private authenticated = false;

  constructor(config: OdooClientConfig) {
    super(config.safety);
    this.config = config;
    this.transport = new JsonRpcTransport(config.url, config.database);
  }

  /**
   * Authenticate with Odoo
   *
   * Must be called before making any RPC calls
   */
  async authenticate(): Promise<OdooSessionInfo> {
    const session = await this.transport.authenticate(this.config.username, this.config.password);
    this.authenticated = true;
    return session;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Get current session info
   */
  getSession(): OdooSessionInfo | null {
    return this.transport.getSession();
  }

  /** Read server-reported version facts; does not authenticate or infer addon support. */
  getServerInfo(): Promise<OdooServerInfo> {
    return this.transport.getServerInfo();
  }

  protected override assertReady(): void {
    if (!this.authenticated) {
      throw new OdooAuthError('Client not authenticated. Call authenticate() first.');
    }
  }

  protected override safetyTarget(): string {
    return this.config.url;
  }

  protected override executeRpc<T>(
    model: string,
    method: string,
    args: RpcArg[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    return this.transport.call<T>(model, method, args, kwargs);
  }

  /**
   * Logout and close connection
   */
  logout(): void {
    this.transport.logout();
    this.authenticated = false;
  }
}
