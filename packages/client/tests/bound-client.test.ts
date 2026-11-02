import { describe, expect, it, vi } from 'vitest';
import {
  BoundClient,
  type BoundServerInfo,
  createBoundClient,
  type ModelRpc,
  OdooSafetyError,
  OdooValidationError,
} from '../src/portable';
import type { RawTrackingRow } from '../src/services/cdc/resolver';

// Vitest's mock type erases generic return signatures; preserve the capability's
// caller-selected result type while keeping argument observation in these fakes.
function mockRpc(implementation: ModelRpc) {
  return vi.fn(implementation) as ModelRpc & ReturnType<typeof vi.fn<ModelRpc>>;
}

describe('credential-free native bound client', () => {
  it('preserves native CRUD encodings and returns capability results without forwarding safety options', async () => {
    const rpc = mockRpc(async () => 42 as never);
    const client = createBoundClient({ rpc });
    const domain: [string, string, unknown][] = [['active', '=', true]];
    const context = { lang: 'en_US' };
    expect(await client.search('res.partner', domain, { limit: 0, offset: 0, context })).toBe(42);
    await client.read('res.partner', 7, ['name'], context);
    await client.searchRead('res.partner', domain, { fields: [], order: 'id', context });
    await client.create('res.partner', { name: 'Portable' }, context);
    await client.write('res.partner', 7, { name: 'Updated' }, context);
    await client.unlink('res.partner', 7);
    await client.searchCount('res.partner', domain, context);
    await client.call('custom.model', 'custom_action', [7], { context }, { safetyLevel: 'READ' });
    expect(rpc.mock.calls).toEqual([
      ['res.partner', 'search', [domain], { limit: 0, offset: 0, context }],
      ['res.partner', 'read', [[7], ['name']], { context }],
      ['res.partner', 'search_read', [domain], { order: 'id', context }],
      ['res.partner', 'create', [{ name: 'Portable' }], { context }],
      ['res.partner', 'write', [[7], { name: 'Updated' }], { context }],
      ['res.partner', 'unlink', [[7]], {}],
      ['res.partner', 'search_count', [domain], { context }],
      ['custom.model', 'custom_action', [7], { context }],
    ]);
  });

  it('projects detached identity and public server facts without retaining extra secret fields', async () => {
    const session = { uid: 7, session_id: 'private-cookie', password: 'private-password' };
    const serverInfo: BoundServerInfo & { raw: { secret: string } } = {
      version: '18.0',
      versionInfo: [18, 0, 'final', 0],
      major: 18,
      series: '18.0',
      protocolVersion: 1,
      raw: { secret: 'private-response' },
    };
    const rpc = mockRpc(async () => [] as never);
    const client = new BoundClient({ rpc, session, serverInfo });
    session.uid = 99;
    serverInfo.major = 99;
    expect(client.getSession()).toEqual({ uid: 7 });
    const first = client.getSession();
    if (first) first.uid = 100;
    expect(client.getSession()).toEqual({ uid: 7 });
    expect(await client.getServerInfo()).toEqual({
      version: '18.0',
      versionInfo: [18, 0, 'final', 0],
      major: 18,
      series: '18.0',
      protocolVersion: 1,
    });
    const info = await client.getServerInfo();
    if (info) info.major = 100;
    expect((await client.getServerInfo())?.major).toBe(18);
    expect(JSON.stringify(client)).not.toContain('private-');
    expect('authenticate' in client).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    const anonymous = createBoundClient({ rpc });
    expect(anonymous.getSession()).toBeNull();
    expect(await anonymous.getServerInfo()).toBeNull();
    expect(() => createBoundClient({ rpc, session: { uid: 0 } })).toThrow(OdooValidationError);
  });

  it('retains lazy service singletons, synchronous getters and employee resolution from public identity', async () => {
    const rpc = mockRpc(async (model) => {
      if (model === 'hr.employee') return [{ id: 9, name: 'Employee' }] as never;
      return [] as never;
    });
    const client = createBoundClient({ rpc, session: { uid: 7 } });
    for (const name of [
      'mail',
      'modules',
      'attendance',
      'timesheets',
      'accounting',
      'urls',
      'properties',
      'cdc',
    ] as const) {
      expect(client[name]).toBe(client[name]);
    }
    expect(client.modules.catalogRevision).toBe(0);
    expect(client.accounting.isClosingEntryFromLines([{ account_id: [1, '129000 Closing'] }])).toBe(
      true,
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(await client.attendance.getStatus()).toEqual({
      checkedIn: false,
      currentAttendance: null,
      employee: [9, 'Employee'],
    });
    expect(rpc.mock.calls[0]).toEqual([
      'hr.employee',
      'search_read',
      [[['user_id', '=', 7]]],
      { fields: ['id'], limit: 1 },
    ]);
  });

  it('keeps convenience safety guards and preserves host denials despite a guest safety override', async () => {
    const hostDenial = new Error('Denied by host');
    const rpc = mockRpc(async () => {
      throw hostDenial;
    });
    const confirm = vi.fn(async () => false);
    const client = createBoundClient({ rpc, safety: { confirm } });
    await expect(client.create('res.partner', { name: 'Blocked' })).rejects.toBeInstanceOf(
      OdooSafetyError,
    );
    expect(rpc).not.toHaveBeenCalled();
    await expect(
      client.call('custom.model', 'destroy_and_notify', [], {}, { safetyLevel: 'READ' }),
    ).rejects.toBe(hostDenial);
    expect(rpc).toHaveBeenCalledWith('custom.model', 'destroy_and_notify', [], {});
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('runs native property scope/binding/read/patch/create through the model capability', async () => {
    const definitions = [{ name: 'count', string: 'Count', type: 'integer' }];
    const rpc = mockRpc(async (model, method, args) => {
      if (method === 'fields_get') {
        return (
          (args[0] as string[])[0] === 'task_properties'
            ? {
                task_properties: {
                  type: 'properties',
                  definition_record: 'project_id',
                  definition_record_field: 'task_properties_definition',
                },
              }
            : { project_id: { type: 'many2one', relation: 'project.project' } }
        ) as never;
      }
      if (method === 'read') {
        return (
          model === 'project.project'
            ? [{ id: 7, task_properties_definition: definitions }]
            : [
                {
                  id: 3,
                  project_id: [7, 'Project'],
                  task_properties: [{ ...definitions[0], value: 2 }],
                },
              ]
        ) as never;
      }
      if (method === 'write') return true as never;
      if (method === 'create') return 41 as never;
      throw new Error(`Unexpected ${model}.${method}`);
    });
    const client = createBoundClient({ rpc });
    const scope = await client.properties.scope('project.task', 'task_properties', {
      parentId: 7,
      context: { lang: 'en_US' },
    });
    const binding = scope.bind({ count: { id: 'count', type: 'integer' } } as const);
    expect(scope.describe().parentId).toBe(7);
    expect((await binding.read([3]))[0]?.properties).toEqual({ count: 2 });
    await binding.patch(3, { count: 0 });
    expect(rpc).toHaveBeenCalledWith(
      'project.task',
      'write',
      [[3], { task_properties: { count: 0 } }],
      { context: { lang: 'en_US' } },
    );
    expect(await binding.create({ name: 'New' }, { count: 0 })).toBe(41);
    expect(rpc).toHaveBeenCalledWith(
      'project.task',
      'create',
      [{ name: 'New', project_id: 7, task_properties: { count: 0 } }],
      { context: { lang: 'en_US' } },
    );
  });

  it('streams nonempty native CDC pages, advances the cursor and caches field metadata', async () => {
    const row = (id: number): RawTrackingRow => ({
      id,
      field_id: [10, 'Status'],
      field_info: false,
      old_value_char: 'before',
      new_value_char: 'after',
      old_value_text: false,
      new_value_text: false,
      old_value_integer: false,
      new_value_integer: false,
      old_value_float: false,
      new_value_float: false,
      old_value_datetime: false,
      new_value_datetime: false,
      currency_id: false,
      mail_message_id: [200 + id, 'test.model,1'],
      create_date: '2026-01-15 10:00:00',
    });
    const pages = [[row(1), row(2)], [row(3)]];
    const rpc = mockRpc(async (model, method, args) => {
      if (model === 'mail.tracking.value') return (pages.shift() ?? []) as never;
      if (model === 'ir.model.fields') {
        return [
          { id: 10, name: 'state', ttype: 'selection', field_description: 'Status' },
        ] as never;
      }
      if (model === 'mail.message' && method === 'read') {
        return (args[0] as number[]).map((id) => ({
          id,
          res_id: id + 1000,
          date: '2026-01-15 10:00:00',
          author_id: [7, 'Author'],
        })) as never;
      }
      throw new Error(`Unexpected ${model}.${method}`);
    });
    const feed = createBoundClient({ rpc }).cdc.getFeed('test.model', {
      pageSize: 2,
      since: '2026-01-01',
    });
    const events = [];
    for await (const event of feed) events.push(event);
    expect(events.map((event) => event.id)).toEqual([1, 2, 3]);
    expect(events[2]?.old.display).toBe('before');
    expect(events[2]?.new.display).toBe('after');
    const trackingCalls = rpc.mock.calls.filter(([model]) => model === 'mail.tracking.value');
    expect(trackingCalls[0]?.[2][0]).toContainEqual(['create_date', '>=', '2026-01-01']);
    expect(trackingCalls[1]?.[2][0]).toContainEqual(['id', '>', 2]);
    expect(rpc.mock.calls.filter(([model]) => model === 'ir.model.fields')).toHaveLength(1);
  });
});
