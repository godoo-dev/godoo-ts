import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type Domain,
  inspectModulePrerequisites,
  JsonRpcTransport,
  type ModuleInspectionClient,
  OdooAccessError,
  OdooAuthError,
  OdooClient,
  OdooNetworkError,
  OdooRpcError,
  OdooSafetyError,
  type SearchReadOptions,
} from '../src';

type Row = Record<string, unknown>;
const MODULE = 'ir.module.module';
const DEPENDENCY = 'ir.module.module.dependency';
const moduleSchema = {
  name: { type: 'char' },
  state: { type: 'selection' },
  dependencies_id: { type: 'one2many', relation: DEPENDENCY },
};
const dependencySchema = {
  name: { type: 'char' },
  module_id: { type: 'many2one', relation: MODULE },
};

function harness(
  options: {
    modules?: Row[];
    edges?: Row[];
    schemas?: Record<string, unknown>;
    version?: unknown;
    error?: (
      model: string,
      method: string,
      kwargs: Record<string, unknown>,
    ) => Record<string, unknown> | undefined;
  } = {},
) {
  const requests: { service: string; method: string; args: unknown[] }[] = [];
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { params } = JSON.parse(String(init?.body));
    requests.push(params);
    if (params.service === 'common')
      return Response.json({
        result:
          params.method === 'login'
            ? 7
            : (options.version ?? {
                server_version: '17.0+e',
                server_version_info: [17, 0, 0, 'final', 0, 'e'],
                server_serie: '17.0',
                protocol_version: 1,
              }),
      });
    const [, , , model, method, args, kwargs] = params.args;
    const error = options.error?.(model, method, kwargs);
    if (error)
      return Response.json({ error: { code: 200, message: 'Odoo Server Error', data: error } });
    if (method === 'fields_get')
      return Response.json({
        result: options.schemas?.[model] ?? (model === MODULE ? moduleSchema : dependencySchema),
      });
    if (method !== 'search_read') throw new Error(`Unexpected mutating/action method: ${method}`);
    const [field, , value] = args[0][0];
    const result =
      model === MODULE
        ? (options.modules ?? []).filter((row) => row[field] === value)
        : (options.edges ?? []).filter((row) => value.includes(row.id));
    return Response.json({
      result: result.map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(([field]) => field === 'id' || kwargs.fields.includes(field)),
        ),
      ),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  const confirm = vi.fn(async () => false);
  const client = new OdooClient({
    url: 'https://offline.invalid',
    database: 'fixture',
    username: 'fixture',
    password: 'fixture-only',
    safety: { confirm },
  });
  return { client, requests, confirm, fetchMock };
}

function addon(id: number, name: string, state = 'installed', dependencies_id: number[] = []): Row {
  return { id, name, state, dependencies_id };
}
function edge(id: number, name: string, owner: number): Row {
  return { id, name, module_id: [owner, 'display name'] };
}

afterEach(() => vi.unstubAllGlobals());

describe('server facts at transport/client boundary', () => {
  it('reads common.version without login/credentials and leaves session unchanged', async () => {
    const { client, requests } = harness();
    expect(await client.getServerInfo()).toMatchObject({
      version: '17.0+e',
      major: 17,
      series: '17.0',
      protocolVersion: 1,
      capabilities: { jsonRpcCommonVersion: true },
    });
    expect(client.getSession()).toBeNull();
    expect(client.isAuthenticated()).toBe(false);
    expect(requests).toEqual([{ service: 'common', method: 'version', args: [] }]);
  });
  it('exposes the same facts directly on transport and never guesses missing facts', async () => {
    harness({
      version: { server_version: 'future-custom', server_version_info: ['20'], extra: true },
    });
    const transport = new JsonRpcTransport('https://offline.invalid', 'fixture');
    expect(await transport.getServerInfo()).toEqual({
      version: 'future-custom',
      versionInfo: ['20'],
      major: null,
      series: null,
      protocolVersion: null,
      capabilities: { jsonRpcCommonVersion: true },
      raw: { server_version: 'future-custom', server_version_info: ['20'], extra: true },
    });
  });
  it('does not infer module support from a future server version', async () => {
    const { client } = harness({
      version: { server_version_info: [99, 0] },
      schemas: { [MODULE]: { name: { type: 'char' }, state: { type: 'selection' } } },
      modules: [addon(1, 'custom')],
    });
    expect((await client.getServerInfo()).major).toBe(99);
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['custom']);
    expect(report.modules[0]).toMatchObject({ status: 'installed', dependencies: null });
    expect(report.closureComplete).toBe(false);
    expect(report.diagnostics[0]?.code).toBe('schema-unavailable');
  });
  it('rejects malformed version responses and preserves network errors', async () => {
    const { client, fetchMock } = harness({ version: '17.0' });
    await expect(client.getServerInfo()).rejects.toThrow('common.version');
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(client.getServerInfo()).rejects.toBeInstanceOf(OdooNetworkError);
  });
});

describe('read-only addon prerequisite inspection', () => {
  it('reads installed/missing transitive closure with context and no mutation calls', async () => {
    const { client, requests, confirm } = harness({
      modules: [addon(1, 'sale', 'installed', [10, 11]), addon(2, 'base')],
      edges: [edge(10, 'base', 1), edge(11, 'custom_missing', 1)],
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale', 'sale'], {
      context: { lang: 'es_ES', allowed_company_ids: [3] },
    });
    expect(report.requested).toEqual(['sale']);
    expect(report.modules.map((node) => [node.name, node.status, node.dependencies])).toEqual([
      ['base', 'installed', []],
      ['custom_missing', 'missing', null],
      ['sale', 'installed', ['base', 'custom_missing']],
    ]);
    expect(report.closureComplete).toBe(false);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'missing-module',
        module: 'custom_missing',
        message: expect.stringContaining('source availability are unknown'),
      }),
    );
    expect(
      report.modules.every(
        (node) => node.sourceAvailability === 'unknown' && node.externalPrerequisites === 'unknown',
      ),
    ).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    for (const request of requests.slice(1)) {
      expect(request.service).toBe('object');
      expect(request.method).toBe('execute_kw');
      expect(['fields_get', 'search_read']).toContain(request.args[4]);
      expect(request.args[6]).toMatchObject({
        context: { lang: 'es_ES', allowed_company_ids: [3] },
      });
    }
  });
  it('terminates cycles, deduplicates names/edges and produces deterministic results', async () => {
    const { client, requests } = harness({
      modules: [addon(1, 'a', 'installed', [10, 11]), addon(2, 'b', 'installed', [12])],
      edges: [edge(11, 'b', 1), edge(10, 'b', 1), edge(12, 'a', 2)],
    });
    await client.authenticate();
    const first = await inspectModulePrerequisites(client, ['b', 'a', 'a']);
    expect(first.requested).toEqual(['a', 'b']);
    expect(first.modules.map((node) => node.dependencies)).toEqual([['b'], ['a']]);
    expect(first.closureComplete).toBe(true);
    expect(first.cycleEdges).toEqual([{ from: 'b', to: 'a' }]);
    expect(await inspectModulePrerequisites(client, ['a', 'b'])).toEqual(first);
    expect(
      requests.filter((r) => r.args[3] === MODULE && r.args[4] === 'search_read'),
    ).toHaveLength(8);
  });
  it('distinguishes all lifecycle states and unknown states without assuming installability', async () => {
    const states = [
      'installed',
      'uninstalled',
      'uninstallable',
      'to install',
      'to upgrade',
      'to remove',
      'future',
    ];
    const { client } = harness({
      modules: states.map((state, id) => addon(id + 1, `m${id}`, state)),
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(states.map((_, id) => `m${id}`));
    expect(report.modules.map((node) => node.status)).toEqual([
      'installed',
      'uninstalled',
      'uninstallable',
      'transitional',
      'transitional',
      'transitional',
      'unknown',
    ]);
    expect(report.modules[6]?.state).toBe('future');
    expect(report.diagnostics.map((d) => d.code)).toEqual([
      'uninstallable-module',
      'transitional-module',
      'transitional-module',
      'transitional-module',
      'unknown-state',
    ]);
  });
  it.each([
    'fields_get',
    'search_read',
  ])('retains module AccessError from %s as inaccessible, never missing', async (blockedMethod) => {
    const { client } = harness({
      error: (model, method) =>
        model === MODULE && method === blockedMethod
          ? { name: 'odoo.exceptions.AccessError', message: 'No module metadata permission' }
          : undefined,
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale']);
    expect(report.modules[0]?.status).toBe('inaccessible');
    expect(report.closureComplete).toBe(false);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'access-denied', cause: expect.any(OdooAccessError) }),
    );
    expect(report.diagnostics.some((d) => d.code === 'missing-module')).toBe(false);
  });
  it('keeps observed state when dependency access is denied', async () => {
    const { client } = harness({
      modules: [addon(1, 'sale', 'installed', [10])],
      error: (model) =>
        model === DEPENDENCY
          ? { exception_type: 'access_error', message: 'Dependencies hidden' }
          : undefined,
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale']);
    expect(report.modules[0]).toMatchObject({ status: 'installed', dependencies: null });
    expect(report.diagnostics[0]).toMatchObject({ model: DEPENDENCY, code: 'access-denied' });
    expect(report.closureComplete).toBe(false);
  });
  it('preserves independently readable addon facts when One2many expansion checks a denied dependency ACL', async () => {
    const { client, requests, confirm } = harness({
      modules: [addon(1, 'sale', 'installed', [10])],
      error: (model, method, kwargs) =>
        model === MODULE &&
        method === 'search_read' &&
        Array.isArray(kwargs.fields) &&
        kwargs.fields.includes('dependencies_id')
          ? { name: 'odoo.exceptions.AccessError', message: 'No read access to Module dependency' }
          : undefined,
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale'], {
      context: { lang: 'en_US' },
    });
    expect(report.modules[0]).toMatchObject({
      id: 1,
      name: 'sale',
      status: 'installed',
      state: 'installed',
      dependencies: null,
    });
    expect(report.closureComplete).toBe(false);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: 'access-denied',
        model: MODULE,
        module: 'sale',
        field: 'dependencies_id',
        relatedModel: DEPENDENCY,
        cause: expect.any(OdooAccessError),
        message: expect.stringContaining('No read access to Module dependency'),
      }),
    ]);
    const reads = requests.filter(
      (request) => request.args[3] === MODULE && request.args[4] === 'search_read',
    );
    expect(reads.map((request) => request.args[6])).toEqual([
      { fields: ['id', 'name', 'state'], order: 'id', context: { lang: 'en_US' } },
      { fields: ['id', 'dependencies_id'], order: 'id', context: { lang: 'en_US' } },
    ]);
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each([
    new OdooAuthError('session expired during relation read'),
    new OdooNetworkError('offline during relation read', new Error('offline')),
    new OdooSafetyError({
      name: 'relation-read',
      model: MODULE,
      level: 'WRITE',
      description: 'blocked',
    }),
    new OdooRpcError('unexpected failure during relation read'),
  ])('propagates %s unchanged during dependency expansion', async (cause) => {
    const { client } = harness({ modules: [addon(1, 'sale', 'installed', [10])] });
    await client.authenticate();
    const seam: ModuleInspectionClient = {
      call: client.call.bind(client),
      searchRead: async <T extends Row>(
        model: string,
        domain: Domain = [],
        options: SearchReadOptions = {},
      ): Promise<T[]> => {
        if (options.fields?.includes('dependencies_id')) throw cause;
        return client.searchRead<T>(model, domain, options);
      },
    };
    await expect(inspectModulePrerequisites(seam, ['sale'])).rejects.toBe(cause);
  });
  it('detects filtered dependency rows instead of treating hidden edges as no dependencies', async () => {
    const { client } = harness({
      modules: [addon(1, 'sale', 'installed', [10, 11]), addon(2, 'base')],
      edges: [edge(10, 'base', 1)],
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale']);
    expect(report.modules.map((node) => node.name)).toEqual(['base', 'sale']);
    expect(report.modules[1]?.dependencies).toBeNull();
    expect(report.diagnostics[0]?.code).toBe('metadata-incomplete');
    expect(report.closureComplete).toBe(false);
  });
  it('rejects duplicate addon matches without choosing one', async () => {
    const { client } = harness({ modules: [addon(1, 'a'), addon(2, 'a')] });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['a']);
    expect(report.modules[0]).toMatchObject({ id: null, status: 'unknown', dependencies: null });
    expect(report.diagnostics[0]?.code).toBe('duplicate-module');
  });
  it('distinguishes a missing metadata model from an absent addon', async () => {
    const { client } = harness({
      error: (model) => ({ name: 'builtins.KeyError', arguments: [model], message: model }),
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale']);
    expect(report.modules[0]?.status).toBe('unknown');
    expect(report.diagnostics[0]?.code).toBe('model-unavailable');
    expect(report.closureComplete).toBe(false);
  });
  it('preserves auth, unexpected RPC and safety errors rather than converting them to missing', async () => {
    const { client } = harness({
      error: () => ({ name: 'builtins.RuntimeError', message: 'Unexpected failure' }),
    });
    await expect(client.modules.inspectPrerequisites(['sale'])).rejects.toBeInstanceOf(
      OdooAuthError,
    );
    await client.authenticate();
    await expect(client.modules.inspectPrerequisites(['sale'])).rejects.toBeInstanceOf(
      OdooRpcError,
    );
    const safety = new OdooSafetyError({
      name: 'test',
      model: MODULE,
      level: 'WRITE',
      description: 'blocked',
    });
    const restricted = { call: vi.fn().mockRejectedValue(safety), searchRead: vi.fn() };
    await expect(inspectModulePrerequisites(restricted, ['sale'])).rejects.toBe(safety);
  });
  it('handles an empty request without RPC and rejects invalid names before RPC', async () => {
    const { client, requests } = harness();
    expect(await client.modules.inspectPrerequisites([])).toEqual({
      requested: [],
      modules: [],
      diagnostics: [],
      closureComplete: true,
      cycleEdges: [],
    });
    await expect(client.modules.inspectPrerequisites([' sale'])).rejects.toBeInstanceOf(TypeError);
    expect(requests).toEqual([]);
  });
  it('does not mistake a malformed metadata response for a missing addon', async () => {
    const { client, fetchMock } = harness();
    await client.authenticate();
    fetchMock.mockResolvedValueOnce(Response.json({ result: moduleSchema }));
    fetchMock.mockResolvedValueOnce(Response.json({ result: {} }));
    await expect(client.modules.inspectPrerequisites(['sale'])).rejects.toThrow(
      'Invalid search_read metadata',
    );
  });
  it('keeps MissingError as a metadata diagnostic rather than an absent addon', async () => {
    const { client } = harness({
      error: () => ({
        name: 'odoo.exceptions.MissingError',
        message: 'Record changed during inspection',
      }),
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale']);
    expect(report.modules[0]?.status).toBe('unknown');
    expect(report.diagnostics[0]).toMatchObject({
      code: 'metadata-incomplete',
      message: expect.stringContaining('Record changed'),
    });
    expect(report.closureComplete).toBe(false);
  });
  it('does not read dependency records through an incompatible relation schema', async () => {
    const { client, requests } = harness({
      modules: [addon(1, 'sale', 'installed', [10])],
      schemas: {
        [DEPENDENCY]: {
          name: { type: 'char' },
          module_id: { type: 'many2one', relation: 'custom.model' },
        },
      },
    });
    await client.authenticate();
    const report = await client.modules.inspectPrerequisites(['sale']);
    expect(report.modules[0]).toMatchObject({ status: 'installed', dependencies: null });
    expect(report.diagnostics[0]?.code).toBe('schema-unavailable');
    expect(
      requests.some(
        (request) => request.args[3] === DEPENDENCY && request.args[4] === 'search_read',
      ),
    ).toBe(false);
  });
});
