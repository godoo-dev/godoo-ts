import { OdooRpcError } from '../types/errors';

/** Facts returned by common.version; not an inferred feature/support matrix. */
export interface OdooServerInfo {
  version: string | null;
  versionInfo: readonly unknown[] | null;
  major: number | null;
  series: string | null;
  protocolVersion: number | null;
  capabilities: { jsonRpcCommonVersion: true };
  raw: Readonly<Record<string, unknown>>;
}

/** @internal Normalize reported facts without guessing from login/session data. */
export function parseServerInfo(value: unknown): OdooServerInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OdooRpcError('common.version returned an invalid server information object');
  }
  const raw = value as Record<string, unknown>;
  const versionInfo = Array.isArray(raw.server_version_info) ? [...raw.server_version_info] : null;
  const major = versionInfo?.[0];
  return {
    version: typeof raw.server_version === 'string' ? raw.server_version : null,
    versionInfo,
    major: typeof major === 'number' && Number.isInteger(major) && major > 0 ? major : null,
    series: typeof raw.server_serie === 'string' ? raw.server_serie : null,
    protocolVersion:
      typeof raw.protocol_version === 'number' && Number.isInteger(raw.protocol_version)
        ? raw.protocol_version
        : null,
    capabilities: { jsonRpcCommonVersion: true },
    raw: { ...raw },
  };
}
