import { OdooProtocolError } from '../types/errors';
import type { JsonRpcResponse } from './types';

/** Validate response provenance before treating an error as a server rejection. */
export function validateRpcResponse<T>(
  value: unknown,
  requestId: number | string,
): asserts value is JsonRpcResponse<T> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OdooProtocolError('Invalid RPC response: expected an object');
  }
  const data = value as Record<string, unknown>;
  if (data.jsonrpc !== '2.0' || data.id !== requestId) {
    throw new OdooProtocolError('Invalid RPC response: invalid version or mismatched request ID');
  }
  if (Object.hasOwn(data, 'error')) {
    const error = data.error;
    if (
      Object.hasOwn(data, 'result') ||
      typeof error !== 'object' ||
      error === null ||
      Array.isArray(error) ||
      typeof (error as Record<string, unknown>).code !== 'number' ||
      !Number.isFinite((error as Record<string, unknown>).code) ||
      typeof (error as Record<string, unknown>).message !== 'string'
    ) {
      throw new OdooProtocolError('Invalid RPC response: malformed error envelope');
    }
  } else if (!Object.hasOwn(data, 'result') || data.result === undefined) {
    throw new OdooProtocolError('Invalid RPC response: missing result field');
  }
}
