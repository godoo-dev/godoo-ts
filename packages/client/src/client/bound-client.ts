import type { RpcArg } from '../rpc/types';
import type { SafetyContext } from '../safety';
import { OdooValidationError } from '../types/errors';
import { OdooClientCore } from './odoo-client-core';
import type { ClientSession } from './types';

/** Model-only capability. Authentication, targets and authorization belong to its host. */
export type ModelRpc = <T = unknown>(
  model: string,
  method: string,
  args: RpcArg[],
  kwargs: Record<string, unknown>,
) => Promise<T>;

/** Optional public version facts; transport responses and credentials are excluded. */
export interface BoundServerInfo {
  version: string | null;
  versionInfo: readonly (string | number | null)[] | null;
  major: number | null;
  series: string | null;
  protocolVersion: number | null;
}

export interface BoundClientConfig {
  rpc: ModelRpc;
  session?: ClientSession | null;
  serverInfo?: BoundServerInfo | null;
  /** Convenience SDK checks only; this option never grants host authority. */
  safety?: SafetyContext | null;
}

function copyServerInfo(value: BoundServerInfo | null | undefined): BoundServerInfo | null {
  if (value == null) return null;
  if (
    (value.version !== null && typeof value.version !== 'string') ||
    (value.series !== null && typeof value.series !== 'string') ||
    (value.major !== null && (!Number.isSafeInteger(value.major) || value.major <= 0)) ||
    (value.protocolVersion !== null &&
      (!Number.isSafeInteger(value.protocolVersion) || value.protocolVersion < 0)) ||
    (value.versionInfo !== null &&
      (!Array.isArray(value.versionInfo) ||
        value.versionInfo.some(
          (part) =>
            part !== null &&
            typeof part !== 'string' &&
            !(typeof part === 'number' && Number.isFinite(part)),
        )))
  ) {
    throw new OdooValidationError('Invalid public server information snapshot.');
  }
  return {
    version: value.version,
    versionInfo: value.versionInfo === null ? null : [...value.versionInfo],
    major: value.major,
    series: value.series,
    protocolVersion: value.protocolVersion,
  };
}

/** Native SDK over an already authorized model capability, without network configuration. */
export class BoundClient extends OdooClientCore {
  readonly #rpc: ModelRpc;
  readonly #session: ClientSession | null;
  readonly #serverInfo: BoundServerInfo | null;

  constructor(config: BoundClientConfig) {
    super(config.safety);
    if (typeof config.rpc !== 'function') {
      throw new OdooValidationError('A model RPC capability is required.');
    }
    const uid = config.session?.uid;
    if (uid !== undefined && (!Number.isSafeInteger(uid) || uid <= 0)) {
      throw new OdooValidationError('Session uid must be a positive safe integer.');
    }
    this.#rpc = config.rpc;
    this.#session = uid === undefined ? null : { uid };
    this.#serverInfo = copyServerInfo(config.serverInfo);
  }

  getSession(): ClientSession | null {
    return this.#session === null ? null : { ...this.#session };
  }

  /** Returns detached supplied facts; it never discovers a server or makes an RPC. */
  async getServerInfo(): Promise<BoundServerInfo | null> {
    return copyServerInfo(this.#serverInfo);
  }

  protected override executeRpc<T>(
    model: string,
    method: string,
    args: RpcArg[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    return this.#rpc<T>(model, method, args, kwargs);
  }
}

export function createBoundClient(config: BoundClientConfig): BoundClient {
  return new BoundClient(config);
}
