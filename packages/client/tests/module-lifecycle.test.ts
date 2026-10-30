import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ModuleLifecycleError,
  OdooAccessError,
  OdooAuthError,
  OdooClient,
  OdooNetworkError,
  OdooRpcError,
  OdooSafetyError,
  OdooValidationError,
} from '../src';

const MODULE = 'ir.module.module';
const DEPENDENCY = 'ir.module.module.dependency';
const CRON_LOCK =
  'Odoo is currently processing a scheduled action.\n' +
  'Module operations are not possible at this time, ' +
  'please try again later or contact your system administrator.';
type Row = Record<string, unknown>;
type Request = { model: string; method: string; args: unknown[]; kwargs: Row };
function addon(id: number, name: string, state = 'uninstalled', dependencies_id: number[] = []) {
  return { id, name, state, dependencies_id, installed_version: '17.0.1.0', shortdesc: name };
}
function firstRow(rows: Row[]): Row {
  const row = rows[0];
  if (!row) throw new Error('Fixture expected a module row');
  return row;
}
function edge(id: number, name: string, owner: number) {
  return { id, name, module_id: [owner, 'display name'] };
}
function fixture(
  options: {
    modules?: Row[];
    edges?: Row[];
    mutate?: (request: Request, modules: Row[], edges: Row[]) => void;
    beforeRead?: (request: Request, modules: Row[], edges: Row[], dispatched: number) => void;
    error?: (request: Request, dispatched: number) => Row | undefined;
    allow?: boolean;
    response?: unknown;
  } = {},
) {
  const modules = options.modules ?? [addon(1, 'sale')];
  const edges = options.edges ?? [];
  const requests: Request[] = [];
  let dispatched = 0;
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { params, id } = JSON.parse(String(init?.body));
    const respond = (body: Record<string, unknown>) =>
      Response.json({ jsonrpc: '2.0', id, ...body });
    if (params.service === 'common') return respond({ result: 7 });
    const [, , , model, method, args, kwargs] = params.args;
    const request = { model, method, args, kwargs };
    requests.push(request);
    if (method.startsWith('button_immediate_')) dispatched++;
    const error = options.error?.(request, dispatched);
    if (error) return respond({ error: { code: 200, message: 'Odoo Server Error', data: error } });
    if (method === 'fields_get')
      return respond({
        result:
          model === MODULE
            ? {
                name: { type: 'char' },
                state: { type: 'selection' },
                dependencies_id: { type: 'one2many', relation: DEPENDENCY },
              }
            : { name: { type: 'char' }, module_id: { type: 'many2one', relation: MODULE } },
      });
    if (method === 'search_read') {
      options.beforeRead?.(request, modules, edges, dispatched);
      const [field, operator, value] = args[0][0];
      const rows = (model === MODULE ? modules : edges).filter((row) =>
        operator === 'in' ? value.includes(row[field]) : row[field] === value,
      );
      return respond({
        result: rows.map((row) =>
          Object.fromEntries(Object.entries(row).filter(([key]) => kwargs.fields.includes(key))),
        ),
      });
    }
    if (
      model !== MODULE ||
      !['button_immediate_install', 'button_immediate_upgrade'].includes(method)
    )
      throw new Error(`Unexpected RPC ${model}.${method}`);
    if (options.mutate) options.mutate(request, modules, edges);
    else for (const module of modules) module.state = 'installed';
    // Odoo returns an action, not an installation success boolean.
    return respond({
      result:
        options.response === undefined
          ? { type: 'ir.actions.client', tag: 'reload' }
          : options.response,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  const confirm = vi.fn(async () => options.allow !== false);
  const client = new OdooClient({
    url: 'https://offline.invalid',
    database: 'fixture',
    username: 'fixture',
    password: 'fixture-only',
    safety: { confirm },
  });
  return {
    client,
    confirm,
    requests,
    modules,
    fetchMock,
    mutations: () => requests.filter((request) => request.method.startsWith('button_')),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('explicit module lifecycle', () => {
  it('installs only the requested root via Odoo and verifies transitive dependency closure', async () => {
    const { client, requests, mutations, confirm } = fixture({
      modules: [
        addon(1, 'sale', 'uninstalled', [10]),
        addon(2, 'mail', 'uninstalled', [11]),
        addon(3, 'base', 'installed'),
      ],
      edges: [edge(10, 'mail', 1), edge(11, 'base', 2)],
    });
    await client.authenticate();
    expect(client.modules.catalogRevision).toBe(0);
    const result = await client.modules.installModule('sale', { context: { lang: 'en_US' } });
    expect(result).toMatchObject({
      id: 1,
      name: 'sale',
      state: 'installed',
      operation: 'install',
      changed: true,
      schemaInvalidated: true,
      attempts: 1,
      shortdesc: 'sale',
    });
    expect(result.prerequisites.modules.map((module) => [module.name, module.state])).toEqual([
      ['base', 'installed'],
      ['mail', 'installed'],
      ['sale', 'installed'],
    ]);
    expect(mutations()).toEqual([
      {
        model: MODULE,
        method: 'button_immediate_install',
        args: [[1]],
        kwargs: { context: { lang: 'en_US' } },
      },
    ]);
    expect(
      requests.every(
        (request) => request.kwargs.context && (request.kwargs.context as Row).lang === 'en_US',
      ),
    ).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(client.modules.catalogRevision).toBe(1);
  });

  it('returns a verified installed no-op and does not dispatch or invalidate', async () => {
    const { client, mutations, confirm } = fixture({ modules: [addon(1, 'sale', 'installed')] });
    await client.authenticate();
    expect(await client.modules.installModule('sale')).toMatchObject({
      state: 'installed',
      changed: false,
      schemaInvalidated: false,
      attempts: 0,
    });
    expect(mutations()).toEqual([]);
    expect(confirm).not.toHaveBeenCalled();
    expect(client.modules.catalogRevision).toBe(0);
  });

  it('upgrades an installed root and verifies new dependencies discovered after Odoo refresh', async () => {
    const { client, mutations } = fixture({
      modules: [addon(1, 'sale', 'installed')],
      mutate: (_request, modules, edges) => {
        firstRow(modules).dependencies_id = [10];
        modules.push(addon(2, 'mail', 'installed'));
        edges.push(edge(10, 'mail', 1));
      },
    });
    await client.authenticate();
    const result = await client.modules.upgradeModule('sale');
    expect(result).toMatchObject({
      operation: 'upgrade',
      state: 'installed',
      changed: true,
      schemaInvalidated: true,
      attempts: 1,
    });
    expect(result.prerequisites.modules.map((module) => module.name)).toEqual(['mail', 'sale']);
    expect(mutations().map((request) => request.method)).toEqual(['button_immediate_upgrade']);
  });

  it.each([
    'uninstalled',
    'uninstallable',
    'to install',
    'to upgrade',
    'to remove',
    'future',
  ])('never reports success for a post-dispatch %s root', async (state) => {
    const { client, mutations } = fixture({
      mutate: (_request, modules) => {
        firstRow(modules).state = state;
      },
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale', { retryDelayMs: 0 })).rejects.toMatchObject({
      name: 'ModuleLifecycleError',
      phase: 'postcondition',
      schemaInvalidated: true,
    });
    expect(mutations()).toHaveLength(1);
    expect(client.modules.catalogRevision).toBe(1);
  });

  it('fails when a dependency remains uninstalled despite an installed root', async () => {
    const { client } = fixture({
      modules: [addon(1, 'sale', 'uninstalled', [10]), addon(2, 'mail')],
      edges: [edge(10, 'mail', 1)],
      mutate: (_request, modules) => {
        firstRow(modules).state = 'installed';
      },
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toBeInstanceOf(ModuleLifecycleError);
  });

  it('does not ignore a disappeared prior dependency edge after upgrade', async () => {
    const { client } = fixture({
      modules: [addon(1, 'sale', 'installed', [10]), addon(2, 'mail', 'installed')],
      edges: [edge(10, 'mail', 1)],
      mutate: (_request, modules, edges) => {
        firstRow(modules).dependencies_id = [];
        modules.pop();
        edges.length = 0;
      },
    });
    await client.authenticate();
    await expect(client.modules.upgradeModule('sale')).rejects.toMatchObject({
      phase: 'postcondition',
    });
  });

  it('rejects a same-name replacement after dispatch', async () => {
    const { client } = fixture({
      mutate: (_request, modules) => {
        firstRow(modules).id = 9;
        firstRow(modules).state = 'installed';
      },
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toThrow('changed identity');
  });

  it.each([
    'uninstallable',
    'to install',
    'to upgrade',
    'to remove',
    'future',
  ])('refuses %s prerequisites before dispatch', async (state) => {
    const { client, mutations } = fixture({ modules: [addon(1, 'sale', state)] });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toMatchObject({
      phase: 'prerequisite',
      schemaInvalidated: false,
    });
    expect(mutations()).toEqual([]);
    expect(client.modules.catalogRevision).toBe(0);
  });

  it.each([
    { modules: [] },
    { modules: [addon(1, 'sale'), addon(2, 'sale')] },
  ])('refuses missing or duplicate roots', async ({ modules }) => {
    const { client, mutations } = fixture({ modules });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toBeInstanceOf(ModuleLifecycleError);
    expect(mutations()).toEqual([]);
  });

  it('refuses incomplete dependency rows instead of treating them as an empty closure', async () => {
    const { client, mutations } = fixture({ modules: [addon(1, 'sale', 'uninstalled', [10])] });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toMatchObject({
      phase: 'prerequisite',
      inspection: { closureComplete: false },
    });
    expect(mutations()).toEqual([]);
  });

  it('preserves inaccessible dependency diagnostics and refuses mutation', async () => {
    const { client, mutations } = fixture({
      modules: [addon(1, 'sale', 'uninstalled', [10])],
      error: (request) =>
        request.model === DEPENDENCY
          ? { name: 'odoo.exceptions.AccessError', message: 'Dependencies restricted' }
          : undefined,
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toMatchObject({
      phase: 'prerequisite',
      inspection: {
        diagnostics: [
          expect.objectContaining({ code: 'access-denied', cause: expect.any(OdooAccessError) }),
        ],
      },
    });
    expect(mutations()).toEqual([]);
  });

  it('rejects dependency cycles and inconsistent installed no-ops', async () => {
    const first = fixture({
      modules: [addon(1, 'sale', 'installed', [10]), addon(2, 'mail')],
      edges: [edge(10, 'mail', 1)],
    });
    await first.client.authenticate();
    await expect(first.client.modules.installModule('sale')).rejects.toBeInstanceOf(
      ModuleLifecycleError,
    );
    const second = fixture({
      modules: [addon(1, 'sale', 'uninstalled', [10])],
      edges: [edge(10, 'sale', 1)],
    });
    await second.client.authenticate();
    await expect(second.client.modules.installModule('sale')).rejects.toBeInstanceOf(
      ModuleLifecycleError,
    );
    expect(second.mutations()).toEqual([]);
  });

  it.each([
    false,
    null,
    true,
    [],
  ])('rejects refusal/malformed lifecycle response %j even with installed state', async (response) => {
    const { client, mutations } = fixture({ modules: [addon(1, 'sale', 'installed')], response });
    await client.authenticate();
    await expect(client.modules.upgradeModule('sale')).rejects.toMatchObject({
      phase: 'postcondition',
      schemaInvalidated: true,
    });
    expect(mutations()).toHaveLength(1);
  });

  it.each([
    {
      type: 'ir.actions.act_window',
      res_model: 'base.module.upgrade',
      target: 'new',
      view_mode: 'form',
      name: 'Apply Schedule Upgrade',
    },
    { error: 'operation refused' },
    {
      id: 9,
      type: 'ir.actions.act_window',
      res_model: 'base.module.upgrade',
      target: 'new',
      view_mode: 'form',
      context: { disable_log: true },
    },
    {
      id: 9,
      type: 'ir.actions.act_window',
      res_model: 'base.module.install',
      target: 'new',
      view_mode: 'form',
      context: { disable_log: true },
    },
    {
      id: 9,
      type: 'ir.actions.act_window',
      res_model: 'ir.module.module',
      target: 'new',
      view_mode: 'form',
      context: { disable_log: true },
    },
    { type: 'ir.actions.client', tag: 'reload', error: 'operation refused' },
    { type: 'ir.actions.client', tag: 'reload', status: 'deferred' },
    { type: 'ir.actions.client', tag: 'reload', success: false },
    {
      type: 'ir.actions.client',
      tag: 'display_notification',
      params: { message: 'Operation refused' },
    },
    { type: 'ir.actions.client', tag: 'unsupported' },
    { type: 'ir.actions.act_window_close' },
    { type: 'ir.actions.act_url', url: '/web', target: 'new' },
    { type: 'ir.actions.act_url', url: '/web/pending-upgrade', target: 'self' },
    ...[
      { url: '/odoo', target: 'new' },
      { url: '/odoo', target: 'current' },
      { url: '/odoo' },
      { url: '/odoo/', target: 'self' },
      { url: '/odoo/pending-upgrade', target: 'self' },
      { url: '/odoo?pending=true', target: 'self' },
      { url: '/odoo#pending', target: 'self' },
      { url: 'https://external.invalid/odoo', target: 'self' },
      { url: '//external.invalid/odoo', target: 'self' },
      { url: '/odoo', target: 'self', error: 'operation refused' },
      { url: '/odoo', target: 'self', status: 'deferred' },
      { url: '/odoo', target: 'self', res_model: 'base.module.upgrade' },
    ].map((action) => ({ type: 'ir.actions.act_url', ...action })),
    {
      type: 'ir.actions.act_window',
      res_model: 'res.config.settings',
      target: 'new',
      view_mode: 'form',
    },
    {
      id: 9,
      type: 'ir.actions.act_window',
      res_model: 'res.config.settings',
      target: 'new',
      view_mode: 'form',
      context: {},
    },
    {
      id: 9,
      type: 'ir.actions.act_window',
      res_model: 'res.config.settings',
      target: 'invalid',
      view_mode: 'form',
      context: { disable_log: true },
    },
    {
      id: 9,
      type: 'ir.actions.act_window',
      res_model: 'res.config.settings',
      target: 'new',
      view_mode: '',
      context: { disable_log: true },
    },
    { arbitrary: 'object' },
  ])('rejects deferred/refusal/unsupported object response %j without retry even for installed upgrades', async (response) => {
    const { client, mutations } = fixture({ modules: [addon(1, 'sale', 'installed')], response });
    await client.authenticate();
    await expect(client.modules.upgradeModule('sale', { retryDelayMs: 0 })).rejects.toMatchObject({
      name: 'ModuleLifecycleError',
      phase: 'postcondition',
      schemaInvalidated: true,
    });
    expect(mutations()).toHaveLength(1);
    expect(client.modules.catalogRevision).toBe(1);
  });

  it.each([
    {},
    { type: 'ir.actions.client', tag: 'reload' },
    { type: 'ir.actions.client', tag: 'reload', params: { menu_id: 3 } },
    { type: 'ir.actions.act_url', url: '/web', target: 'self' },
    {
      id: 9,
      type: 'ir.actions.act_window',
      res_model: 'res.config.settings',
      target: 'new',
      view_mode: 'form',
      context: { disable_log: true },
    },
    {
      id: 10,
      type: 'ir.actions.act_window',
      res_model: 'res.company',
      target: 'current',
      view_mode: 'tree,form',
      context: { disable_log: true, res_id: 1 },
    },
  ])('preserves supported Odoo17 completion/configuration response %j without requiring version change', async (response) => {
    const { client, mutations } = fixture({ modules: [addon(1, 'sale', 'installed')], response });
    await client.authenticate();
    await expect(client.modules.upgradeModule('sale')).resolves.toMatchObject({
      operation: 'upgrade',
      installed_version: '17.0.1.0',
      state: 'installed',
      changed: true,
    });
    expect(mutations()).toHaveLength(1);
  });

  it.each([
    'install',
    'upgrade',
  ] as const)('accepts the exact Odoo18 self redirect for %s after verifying installed closure', async (operation) => {
    const { client, mutations } = fixture({
      modules: [addon(1, 'sale', operation === 'upgrade' ? 'installed' : 'uninstalled')],
      response: { type: 'ir.actions.act_url', target: 'self', url: '/odoo' },
    });
    await client.authenticate();
    const result =
      operation === 'install'
        ? await client.modules.installModule('sale')
        : await client.modules.upgradeModule('sale');
    expect(result).toMatchObject({
      operation,
      state: 'installed',
      changed: true,
      schemaInvalidated: true,
    });
    expect(mutations()).toHaveLength(1);
  });

  it('still rejects incomplete installed closure after the Odoo18 redirect', async () => {
    const { client } = fixture({
      modules: [addon(1, 'sale', 'uninstalled', [10]), addon(2, 'base')],
      edges: [edge(10, 'base', 1)],
      response: { type: 'ir.actions.act_url', target: 'self', url: '/odoo' },
      mutate: (_request, modules) => {
        firstRow(modules).state = 'installed';
      },
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toMatchObject({
      name: 'ModuleLifecycleError',
      phase: 'postcondition',
      schemaInvalidated: true,
    });
  });

  it('requires installed state for upgrade', async () => {
    const { client, mutations } = fixture();
    await client.authenticate();
    await expect(client.modules.upgradeModule('sale')).rejects.toThrow('must be installed');
    expect(mutations()).toEqual([]);
  });

  it('detects a stale root immediately before mutation', async () => {
    const { client, mutations } = fixture({
      beforeRead: (request, modules) => {
        if ((request.kwargs.fields as string[]).includes('shortdesc'))
          firstRow(modules).state = 'to remove';
      },
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toMatchObject({
      phase: 'stale',
      schemaInvalidated: false,
    });
    expect(mutations()).toEqual([]);
  });

  it.each([
    'install',
    'upgrade',
  ] as const)('retries only classified cron contention for %s with a bounded delay', async (operation) => {
    vi.useFakeTimers();
    const { client, mutations } = fixture({
      modules: [addon(1, 'sale', operation === 'upgrade' ? 'installed' : 'uninstalled')],
      error: (request, attempt) =>
        request.method.startsWith('button_') && attempt < 3
          ? { name: 'odoo.exceptions.UserError', message: CRON_LOCK }
          : undefined,
    });
    await client.authenticate();
    const pending =
      operation === 'install'
        ? client.modules.installModule('sale')
        : client.modules.upgradeModule('sale');
    const resolved = expect(pending).resolves.toMatchObject({ attempts: 3, state: 'installed' });
    await vi.advanceTimersByTimeAsync(0);
    expect(mutations()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(mutations()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mutations()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(5000);
    await resolved;
    expect(mutations()).toHaveLength(3);
    expect(client.modules.catalogRevision).toBe(3);
  });

  it('propagates the final classified lock and never exceeds maxAttempts', async () => {
    const { client, mutations } = fixture({
      error: (request) =>
        request.method.startsWith('button_')
          ? { name: 'odoo.exceptions.UserError', message: CRON_LOCK }
          : undefined,
    });
    await client.authenticate();
    await expect(
      client.modules.installModule('sale', { maxAttempts: 2, retryDelayMs: 0 }),
    ).rejects.toBeInstanceOf(OdooValidationError);
    expect(mutations()).toHaveLength(2);
  });

  it('rechecks state and identity before a retry and refuses a competing completed install', async () => {
    let locked = false;
    const { client, mutations } = fixture({
      error: (request) => {
        if (request.method.startsWith('button_')) {
          locked = true;
          return { name: 'odoo.exceptions.UserError', message: CRON_LOCK };
        }
        return undefined;
      },
      beforeRead: (_request, modules) => {
        if (locked) firstRow(modules).state = 'installed';
      },
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale', { retryDelayMs: 0 })).rejects.toMatchObject({
      phase: 'stale',
    });
    expect(mutations()).toHaveLength(1);
  });

  it.each([
    {
      name: 'odoo.exceptions.UserError',
      message: 'Cannot modify scheduled action ir_cron for another reason',
    },
    { name: 'odoo.exceptions.ValidationError', message: CRON_LOCK },
    { name: 'builtins.RuntimeError', message: CRON_LOCK },
    { name: 'odoo.exceptions.UserError', message: 'Odoo está procesando una acción planificada.' },
    { name: 'odoo.exceptions.AccessError', message: CRON_LOCK },
  ])('does not retry unclassified error $name: $message', async (error) => {
    const { client, mutations } = fixture({
      error: (request) => (request.method.startsWith('button_') ? error : undefined),
    });
    await client.authenticate();
    await expect(client.modules.installModule('sale', { retryDelayMs: 0 })).rejects.toBeInstanceOf(
      OdooRpcError,
    );
    expect(mutations()).toHaveLength(1);
  });

  it('preserves per-client safety rejection and conservatively invalidates without sending mutation RPC', async () => {
    const { client, mutations, confirm } = fixture({ allow: false });
    await client.authenticate();
    await expect(client.modules.installModule('sale')).rejects.toBeInstanceOf(OdooSafetyError);
    expect(confirm).toHaveBeenCalledOnce();
    expect(mutations()).toEqual([]);
    expect(client.modules.catalogRevision).toBe(1);
  });

  it.each([
    new OdooAuthError('expired'),
    new OdooNetworkError(CRON_LOCK, new Error('offline')),
    new OdooRpcError(CRON_LOCK),
  ])('propagates original %s unchanged with no retry', async (cause) => {
    const { client } = fixture();
    await client.authenticate();
    const originalCall = client.call.bind(client);
    const call = vi
      .spyOn(client, 'call')
      .mockImplementation(async (model, method, args, kwargs, options) => {
        if (method.startsWith('button_')) throw cause;
        return originalCall(model, method, args, kwargs, options);
      });
    await expect(client.modules.installModule('sale', { retryDelayMs: 0 })).rejects.toBe(cause);
    expect(call.mock.calls.filter((args) => args[1].startsWith('button_'))).toHaveLength(1);
  });

  it('does not retry a postcondition read network error or hide an ambiguous lifecycle outcome', async () => {
    const { client } = fixture();
    await client.authenticate();
    const cause = new OdooNetworkError('lost after mutation', new Error('offline'));
    const original = client.call.bind(client);
    let changed = false;
    vi.spyOn(client, 'call').mockImplementation(async (model, method, args, kwargs, options) => {
      if (changed) throw cause;
      const result = await original(model, method, args, kwargs, options);
      if (method.startsWith('button_')) changed = true;
      return result;
    });
    await expect(client.modules.installModule('sale')).rejects.toBe(cause);
    expect(client.modules.catalogRevision).toBe(1);
  });

  it.each([
    { maxAttempts: 0 },
    { maxAttempts: 6 },
    { maxAttempts: 1.5 },
    { retryDelayMs: -1 },
    { retryDelayMs: 30001 },
    { retryDelayMs: Number.NaN },
  ])('rejects invalid bounded options before any RPC: %j', async (options) => {
    const { client, requests } = fixture();
    await expect(client.modules.installModule('sale', options)).rejects.toBeInstanceOf(TypeError);
    expect(requests).toEqual([]);
  });

  it('rejects invalid names before any RPC', async () => {
    const { client, requests } = fixture();
    await expect(client.modules.installModule(' sale')).rejects.toBeInstanceOf(TypeError);
    expect(requests).toEqual([]);
  });
});
