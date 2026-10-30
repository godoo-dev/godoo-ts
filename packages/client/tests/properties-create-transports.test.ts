import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPropertiesScope, OAuthProxyClient, OdooClient, OdooSafetyError } from '../src/index';

describe('friendly property creation through client transports', () => {
  afterEach(() => vi.unstubAllGlobals());

  function server() {
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(init.body as string);
      const args = request.params.args;
      const method = args[4];
      const result =
        request.params.service === 'common'
          ? 1
          : method === 'fields_get'
            ? args[5][0][0] === 'task_properties'
              ? {
                  task_properties: {
                    type: 'properties',
                    definition_record: 'project_id',
                    definition_record_field: 'task_properties_definition',
                  },
                }
              : { project_id: { type: 'many2one', relation: 'project.project' } }
            : method === 'read'
              ? [
                  {
                    id: 7,
                    task_properties_definition: [
                      {
                        name: 'p',
                        string: 'Priority',
                        type: 'selection',
                        selection: [['hi', 'High']],
                      },
                    ],
                  },
                ]
              : 41;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }
  const declarations = {
    priority: { label: 'Priority', type: 'selection', options: { high: { label: 'High' } } },
  } as const;

  it('sends scoped encoded values in the bearer execute_kw envelope', async () => {
    const fetch = server();
    const client = new OAuthProxyClient({
      proxyBaseUrl: 'https://proxy.invalid',
      getAccessToken: async () => 'test-token',
    });
    const tasks = (
      await createPropertiesScope(client, 'project.task', 'task_properties', {
        parentId: 7,
        context: { lang: 'en_US' },
      })
    ).bind(declarations);
    fetch.mockClear();
    expect(await tasks.create({ name: 'New' }, { priority: 'high' })).toBe(41);
    expect(fetch).toHaveBeenCalledTimes(2); // Parent refresh, then creation.
    const init = fetch.mock.calls[1]?.[1];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    const request = JSON.parse(init?.body as string);
    expect(request.params.args.slice(3)).toEqual([
      'project.task',
      'create',
      [{ name: 'New', project_id: 7, task_properties: { p: 'hi' } }],
      { context: { lang: 'en_US' } },
    ]);
  });

  it('keeps the direct client WRITE guard before the create transport dispatch', async () => {
    const fetch = server();
    const confirm = vi.fn(async () => false);
    const client = new OdooClient({
      url: 'http://unused',
      database: 'test',
      username: 'test',
      password: 'test',
      safety: { confirm },
    });
    await client.authenticate();
    const tasks = (
      await client.properties.scope('project.task', 'task_properties', { parentId: 7 })
    ).bind(declarations);
    fetch.mockClear();
    await expect(tasks.create({ name: 'Blocked' }, { priority: 'high' })).rejects.toBeInstanceOf(
      OdooSafetyError,
    );
    expect(confirm).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: 'odoo.create', level: 'WRITE', model: 'project.task' }),
    );
    expect(fetch).toHaveBeenCalledTimes(1); // Only the read-only parent refresh.
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body as string).params.args[4]).toBe('read');
  });
});
