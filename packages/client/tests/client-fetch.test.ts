import { afterEach, expect, it, vi } from 'vitest';
import { OdooClient } from '../src/index';

afterEach(() => vi.unstubAllGlobals());

it('uses the configured fetch or looks up the global fetch when sending the request', async () => {
  const config = { url: 'https://odoo.invalid', database: 'db', username: 'user', password: 'pw' };
  const injected = vi.fn(async () => Response.json({ jsonrpc: '2.0', id: 1, result: 7 }));
  vi.stubGlobal('fetch', vi.fn());
  const custom = new OdooClient({ ...config, fetch: injected });
  const standard = new OdooClient(config);
  const globalFetch = vi.fn(async () => Response.json({ jsonrpc: '2.0', id: 1, result: 8 }));
  vi.stubGlobal('fetch', globalFetch);

  expect((await custom.authenticate()).uid).toBe(7);
  expect((await standard.authenticate()).uid).toBe(8);
  expect(injected).toHaveBeenCalledTimes(1);
  expect(injected.mock.contexts[0]).toBeUndefined();
  expect(globalFetch).toHaveBeenCalledTimes(1);
});
