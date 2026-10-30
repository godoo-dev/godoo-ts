import { afterEach, describe, expect, it, vi } from 'vitest';
import { BearerJsonRpcTransport } from '../src/rpc/bearer-transport';
import { JsonRpcTransport } from '../src/rpc/transport';
import { OdooProtocolError, OdooValidationError } from '../src/types/errors';

// Both write transports must distinguish uncertainty from explicit rejection.
describe.each(['direct', 'bearer'] as const)('%s write response provenance', (kind) => {
  afterEach(() => vi.unstubAllGlobals());
  function call() {
    return kind === 'direct'
      ? new JsonRpcTransport('http://unused', 'test').callRpc('call', {
          service: 'object',
          method: 'execute_kw',
        })
      : new BearerJsonRpcTransport({
          proxyBaseUrl: 'http://unused',
          getAccessToken: async () => 'unused',
        }).call('project.task', 'write', [[1], {}]);
  }
  it.each([
    null,
    [],
    false,
    {},
    { jsonrpc: '2.0', id: 1 },
    { result: true },
    { error: { code: 200, message: 'Rejected' } },
    { jsonrpc: '2.0', id: 99, result: true },
    { jsonrpc: '1.0', id: 1, result: true },
    { jsonrpc: '2.0', id: 1, error: 'rejected' },
    { jsonrpc: '2.0', id: 1, error: {} },
    { jsonrpc: '2.0', id: 1, error: { code: '200', message: 'bad' } },
    { jsonrpc: '2.0', id: 1, result: true, error: { code: 200, message: 'bad' } },
  ])('keeps malformed response %j uncertain without retrying', async (body) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(call()).rejects.toBeInstanceOf(OdooProtocolError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retains a valid explicit server rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              error: {
                code: 200,
                message: 'Rejected',
                data: { exception_type: 'validation_error' },
              },
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(call()).rejects.toBeInstanceOf(OdooValidationError);
  });
  it.each([
    true,
    false,
    null,
    { unusual: true },
  ])('retains result %j for the mutation classifier', async (result) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 }),
      ),
    );
    await expect(call()).resolves.toEqual(result);
  });
});
