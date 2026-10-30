import assert from 'node:assert/strict';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createPropertiesScope,
  getPropertyValue,
  ModuleManager,
  OdooClient,
  type OdooCrudClient,
  OdooNetworkError,
  type PropertiesDefinition,
  type PropertiesReadFormat,
  propertiesToWriteFormat,
} from '../src/index.js';

// Each case owns its records; the existing global setup owns the disposable database.
describe('Parent-scoped properties over real Odoo18 RPC', () => {
  let client: OdooClient;
  let projectId: number;
  let otherProjectId: number;
  let partners: number[];
  let ids: number[];
  let projects: number[];
  let definitions: PropertiesDefinition;
  let manager: ModuleManager;
  let installedProject = false;

  beforeAll(async () => {
    client = new OdooClient({
      url: process.env.ODOO_URL || 'http://localhost:8069',
      database: process.env.ODOO_DB_NAME || 'odoo',
      username: process.env.ODOO_DB_USER || 'admin',
      password: process.env.ODOO_DB_PASSWORD || 'admin',
    });
    await client.authenticate();
    manager = new ModuleManager(client);
    if (!(await manager.isModuleInstalled('project'))) {
      await manager.installModule('project');
      installedProject = true;
    }
  });

  beforeEach(async () => {
    ids = [];
    partners = [];
    projects = [];
    definitions = [
      {
        name: 'priority_key',
        string: 'Priority',
        type: 'selection',
        selection: [
          ['high_key', 'High'],
          ['low_key', 'Low'],
        ],
      },
      { name: 'effort_key', string: 'Estimated effort', type: 'float' },
      { name: 'owner_key', string: 'Reviewer', type: 'many2one', comodel: 'res.partner' },
      { name: 'watchers_key', string: 'Watchers', type: 'many2many', comodel: 'res.partner' },
      {
        name: 'labels_key',
        string: 'Labels',
        type: 'tags',
        tags: [
          ['ready_key', 'Ready', 1],
          ['blocked_key', 'Blocked', 2],
        ],
      },
      { name: 'active_key', string: 'Active', type: 'boolean' },
      { name: 'note_key', string: 'Note', type: 'char' },
      { name: 'date_key', string: 'Due', type: 'date' },
      { name: 'unbound_key', string: 'Other application value', type: 'char' },
    ];
    for (const name of ['Scoped reviewer A', 'Scoped reviewer B'])
      partners.push(await client.create('res.partner', { name }));
    projectId = await client.create('project.project', {
      name: 'Scope project A',
      task_properties_definition: definitions,
    });
    projects.push(projectId);
    otherProjectId = await client.create('project.project', {
      name: 'Scope project B',
      task_properties_definition: [
        { name: 'other_effort', string: 'Estimated effort', type: 'char' },
      ],
    });
    projects.push(otherProjectId);
    for (let index = 0; index < 2; index++)
      ids.push(
        await client.create('project.task', {
          name: `Scope task ${index}`,
          project_id: projectId,
          task_properties: {
            priority_key: index === 0 ? 'high_key' : 'low_key',
            effort_key: index + 1,
            owner_key: partners[index],
            watchers_key: partners,
            labels_key: ['ready_key'],
            active_key: false,
            note_key: 'note',
            date_key: '2026-10-29',
            unbound_key: `keep ${index}`,
          },
        }),
      );
  });

  afterEach(async () => {
    try {
      if (ids.length) await client.unlink('project.task', ids);
    } finally {
      try {
        if (projects.length) await client.unlink('project.project', projects);
      } finally {
        if (partners.length) await client.unlink('res.partner', partners);
      }
    }
  });
  afterAll(async () => {
    try {
      if (installedProject) await manager.uninstallModule('project');
    } finally {
      client.logout();
    }
  });

  function id(index = 0): number {
    const value = ids[index];
    assert(value !== undefined);
    return value;
  }
  const declarations = {
    priority: {
      label: 'Priority',
      type: 'selection',
      options: { high: { label: 'High' }, low: { label: 'Low' } },
    },
    effort: { label: 'Estimated effort', type: 'float' },
    reviewer: { label: 'Reviewer', type: 'many2one', comodel: 'res.partner' },
    watchers: { label: 'Watchers', type: 'many2many' },
    labels: {
      label: 'Labels',
      type: 'tags',
      options: { ready: { label: 'Ready' }, blocked: { label: 'Blocked' } },
    },
    active: { label: 'Active', type: 'boolean' },
    note: { label: 'Note', type: 'char' },
    due: { label: 'Due', type: 'date' },
  } as const;
  async function binding() {
    const scope = await client.properties.scope('project.task', 'task_properties', {
      parentId: projectId,
      context: { lang: 'en_US' },
    });
    return { scope, tasks: scope.bind(declarations) };
  }
  async function raw(taskId = id()) {
    const [row] = await client.read<{ task_properties: PropertiesReadFormat }>(
      'project.task',
      taskId,
      ['task_properties'],
    );
    assert(row);
    return row.task_properties;
  }

  it('creates friendly properties in the scoped parent and independently reads technical values', async () => {
    const defaultDefinition = {
      name: 'default_key',
      string: 'Default effort',
      type: 'float' as const,
      default: 9,
    };
    definitions.push(defaultDefinition);
    await client.write('project.project', projectId, { task_properties_definition: definitions });
    const { tasks } = await binding();
    const created = await tasks.create(
      { name: 'Created with friendly properties' },
      {
        priority: 'high',
        effort: 0,
        reviewer: partners[0],
        watchers: partners,
        labels: ['blocked'],
        active: false,
        note: 'Created note',
        due: '2026-10-30',
      },
    );
    ids.push(created);
    const [row] = await client.read('project.task', created, [
      'name',
      'project_id',
      'task_properties',
    ]);
    assert(row);
    expect(row.name).toBe('Created with friendly properties');
    expect(row.project_id).toEqual([projectId, 'Scope project A']);
    expect(propertiesToWriteFormat(row.task_properties as PropertiesReadFormat)).toMatchObject({
      priority_key: 'high_key',
      effort_key: 0,
      owner_key: partners[0],
      watchers_key: partners,
      labels_key: ['blocked_key'],
      active_key: false,
      note_key: 'Created note',
      date_key: '2026-10-30',
      default_key: 9,
    });
    expect((await tasks.read([created]))[0]?.properties).toEqual({
      priority: 'high',
      effort: 0,
      reviewer: partners[0],
      watchers: partners,
      labels: ['blocked'],
      active: false,
      note: 'Created note',
      due: '2026-10-30',
    });
    const defaults = await tasks.create({ name: 'Created with defaults', project_id: projectId });
    ids.push(defaults);
    expect(propertiesToWriteFormat(await raw(defaults)).default_key).toBe(9);
    const cleared = await tasks.create(
      { name: 'Created with clears' },
      {
        priority: null,
        effort: null,
        reviewer: null,
        watchers: null,
        labels: null,
        active: false,
        note: null,
        due: null,
      },
    );
    ids.push(cleared);
    expect((await tasks.read([cleared]))[0]?.properties).toEqual({
      priority: null,
      effort: null,
      reviewer: null,
      watchers: null,
      labels: null,
      active: false,
      note: null,
      due: null,
    });
  });

  it('preflights creation without inserting records for bad input or stale bindings', async () => {
    const { tasks } = await binding();
    const before = await client.searchCount('project.task', [['project_id', '=', projectId]]);
    await expect(
      tasks.create({ name: 'Wrong parent', project_id: otherProjectId }, { effort: 0 }),
    ).rejects.toMatchObject({ code: 'wrong-parent' });
    await expect(
      tasks.create({ name: 'Raw conflict', task_properties: {} }, { effort: 0 }),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(
      tasks.create({ name: 'Bad alias' }, { priority: 'urgent' } as never),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    await client.write('project.project', projectId, {
      task_properties_definition: definitions.map((def) =>
        def.name === 'effort_key' ? { ...def, type: 'char' } : def,
      ),
    });
    await expect(tasks.create({ name: 'Stale binding' }, { effort: 0 })).rejects.toMatchObject({
      code: 'stale-binding',
    });
    expect(await client.searchCount('project.task', [['project_id', '=', projectId]])).toBe(before);
  });

  it('does not replay creation after a response lost following a server commit', async () => {
    let creates = 0;
    const lost = new OdooNetworkError(
      'Injected lost create response',
      new Error('Response discarded'),
    );
    const observed: Pick<OdooCrudClient, 'call' | 'read' | 'write'> = {
      call: async <T = unknown>(...args: Parameters<OdooCrudClient['call']>): Promise<T> => {
        const result = await client.call<T>(...args);
        if (args[1] === 'create') {
          assert(typeof result === 'number');
          ids.push(result);
          creates++;
          throw lost;
        }
        return result;
      },
      read: client.read.bind(client),
      write: client.write.bind(client),
    };
    const scope = await createPropertiesScope(observed, 'project.task', 'task_properties', {
      parentId: projectId,
    });
    const tasks = scope.bind(declarations);
    await expect(
      tasks.create({ name: 'Uncertain creation' }, { effort: 0, priority: 'low' }),
    ).rejects.toBe(lost);
    expect(creates).toBe(1);
    const found = await client.search('project.task', [
      ['project_id', '=', projectId],
      ['name', '=', 'Uncertain creation'],
    ]);
    expect(found).toEqual([ids.at(-1)]);
    expect(propertiesToWriteFormat(await raw(found[0])).priority_key).toBe('low_key');
  });

  it('discovers parent metadata, validates aliases and returns task.properties with normalized relations', async () => {
    const { scope, tasks } = await binding();
    const rows = await tasks.read(ids);
    expect(rows.map((row) => row.id)).toEqual(ids);
    expect(rows[0]?.properties).toEqual({
      priority: 'high',
      effort: 1,
      reviewer: partners[0],
      watchers: partners,
      labels: ['ready'],
      active: false,
      note: 'note',
      due: '2026-10-29',
    });
    expect(rows[1]?.properties.priority).toBe('low');
    const first = rows[0];
    assert(first);
    expect(getPropertyValue(first.raw, 'owner_key')).toEqual([partners[0], 'Scoped reviewer A']);
    expect(JSON.stringify(scope.describe())).toContain('priority_key');
    expect(JSON.stringify(tasks.mapping())).toContain('high_key');
  });

  it('patches aliases and sparse batches while preserving different unbound values and relations', async () => {
    const { tasks } = await binding();
    const single = await tasks.patch(id(), { priority: 'low', effort: 0, labels: ['blocked'] });
    expect([single.status]).toEqual(['acknowledged']);
    await tasks.patchMany(ids, { active: false });
    const receipt = await tasks.patchEach([
      { id: id(), changes: { note: '' } },
      { id: id(1), changes: { effort: 0 } },
    ]);
    expect(receipt.map((result) => result.id)).toEqual(ids);
    expect(receipt.every((result) => result.status === 'acknowledged')).toBe(true);
    const [first, second] = await tasks.read(ids);
    expect(first?.properties.priority).toBe('low');
    expect(first?.properties.effort).toBe(0);
    // Odoo normalizes empty character values to false; the binding exposes null.
    expect(first?.properties.note).toBeNull();
    expect(second?.properties.effort).toBe(0);
    for (let index = 0; index < 2; index++) {
      const values = propertiesToWriteFormat(await raw(id(index)));
      expect(values.unbound_key).toBe(`keep ${index}`);
      expect(values.owner_key).toBe(partners[index]);
      expect(values.watchers_key).toEqual(partners);
    }
  });

  it('clears values by type without losing numeric zero or false booleans', async () => {
    const { tasks } = await binding();
    await tasks.patch(id(), {
      priority: null,
      effort: 0,
      reviewer: null,
      watchers: null,
      labels: [],
      active: false,
      note: null,
      due: null,
    });
    const [row] = await tasks.read([id()]);
    expect(row?.properties).toEqual({
      priority: null,
      effort: 0,
      reviewer: null,
      watchers: null,
      labels: null,
      active: false,
      note: null,
      due: null,
    });
    expect(propertiesToWriteFormat(await raw()).unbound_key).toBe('keep 0');
    await tasks.patch(id(), { effort: null });
    expect((await tasks.read([id()]))[0]?.properties.effort).toBeNull();
  });

  it('keeps existing reads valid after unrelated properties and options are added', async () => {
    const { tasks } = await binding();
    const changed = structuredClone(definitions);
    changed.push({ name: 'new_unbound_key', string: 'New unbound', type: 'char' });
    const priority = changed.find((def) => def.name === 'priority_key');
    assert(priority?.type === 'selection');
    priority.selection.push(['new_option_key', 'New option']);
    await client.write('project.project', projectId, { task_properties_definition: changed });
    expect((await tasks.read([id()]))[0]?.properties.priority).toBe('high');
    await tasks.patch(id(), { effort: 0 });
    expect((await tasks.read([id()]))[0]?.properties.effort).toBe(0);
  });

  it('retains property and option identities across renames and rejects removed mapped options', async () => {
    const { scope, tasks } = await binding();
    const changed = structuredClone(definitions);
    const priority = changed.find((def) => def.name === 'priority_key');
    assert(priority?.type === 'selection');
    priority.string = 'Renamed priority';
    priority.selection = [
      ['high_key', 'Urgent'],
      ['low_key', 'Normal'],
    ];
    await client.write('project.project', projectId, { task_properties_definition: changed });
    await scope.refresh();
    await tasks.patch(id(), { priority: 'high' });
    expect((await tasks.read([id()]))[0]?.properties.priority).toBe('high');
    priority.selection = [['low_key', 'Normal']];
    await client.write('project.project', projectId, { task_properties_definition: changed });
    await expect(tasks.patch(id(), { effort: 9 })).rejects.toThrow();
    expect(propertiesToWriteFormat(await raw()).effort_key).toBe(1);
  });

  it('rejects duplicate labels and type drift instead of silently binding another ID', async () => {
    const scope = await client.properties.scope('project.task', 'task_properties', {
      parentId: projectId,
    });
    await client.write('project.project', projectId, {
      task_properties_definition: [
        ...definitions,
        { name: 'duplicate_effort', string: 'Estimated effort', type: 'float' },
      ],
    });
    await scope.refresh();
    expect(() => scope.bind({ effort: { label: 'Estimated effort', type: 'float' } })).toThrow();
    const tasks = scope.bind({ effort: { id: 'effort_key', type: 'float' } });
    await client.write('project.project', projectId, {
      task_properties_definition: definitions.map((def) =>
        def.name === 'effort_key' ? { name: def.name, string: def.string, type: 'char' } : def,
      ),
    });
    await expect(tasks.patch(id(), { effort: 9 })).rejects.toThrow();
  });

  it('rejects a moved task and preflights a mixed-parent batch before any writes', async () => {
    const { tasks } = await binding();
    await client.write('project.task', id(1), { project_id: otherProjectId });
    await expect(tasks.read([id(1)])).rejects.toThrow();
    await expect(tasks.patchMany(ids, { effort: 9 })).rejects.toThrow();
    expect(propertiesToWriteFormat(await raw()).effort_key).toBe(1);
  });

  it('rejects unmapped read options while preserving them when patching an unrelated property', async () => {
    const scope = await client.properties.scope('project.task', 'task_properties', {
      parentId: projectId,
    });
    const tasks = scope.bind({
      priority: { label: 'Priority', type: 'selection', options: { high: { label: 'High' } } },
      effort: { label: 'Estimated effort', type: 'float' },
    } as const);
    await expect(tasks.read([id(1)])).rejects.toThrow(/low_key/);
    await tasks.patch(id(1), { effort: 0 });
    const values = propertiesToWriteFormat(await raw(id(1)));
    expect(values.priority_key).toBe('low_key');
    expect(values.effort_key).toBe(0);
  });

  it('uses one parent read, one child read and one write per record after discovery', async () => {
    const events: string[] = [];
    const observed: Pick<OdooCrudClient, 'call' | 'read' | 'write'> = {
      call: async (...args) => {
        events.push('call');
        return client.call(...args);
      },
      read: async (...args) => {
        events.push(`read:${args[0]}`);
        return client.read(...args);
      },
      write: async (...args) => {
        events.push(`write:${args[0]}`);
        return client.write(...args);
      },
    };
    const scope = await createPropertiesScope(observed, 'project.task', 'task_properties', {
      parentId: projectId,
    });
    const tasks = scope.bind({ effort: { label: 'Estimated effort', type: 'float' } } as const);
    events.length = 0;
    await tasks.patchMany(ids, { effort: 0 });
    expect(events).toEqual([
      'read:project.project',
      'read:project.task',
      'write:project.task',
      'write:project.task',
    ]);
  });

  it('makes the documented lost-update window observable with deliberately interleaved writers', async () => {
    let interleave = false;
    const observed: Pick<OdooCrudClient, 'call' | 'read' | 'write'> = {
      call: client.call.bind(client),
      write: client.write.bind(client),
      read: async <T extends object = Record<string, unknown>>(
        ...args: Parameters<OdooCrudClient['read']>
      ): Promise<T[]> => {
        const rows = await client.read<T>(...args);
        if (interleave && args[0] === 'project.task') {
          interleave = false;
          const current = propertiesToWriteFormat(await raw());
          await client.write('project.task', id(), {
            task_properties: { ...current, unbound_key: 'concurrent writer' },
          });
        }
        return rows;
      },
    };
    const scope = await createPropertiesScope(observed, 'project.task', 'task_properties', {
      parentId: projectId,
    });
    const tasks = scope.bind({ effort: { label: 'Estimated effort', type: 'float' } } as const);
    interleave = true;
    await tasks.patch(id(), { effort: 0 });
    const values = propertiesToWriteFormat(await raw());
    expect(values.effort_key).toBe(0);
    expect(values.unbound_key).toBe('keep 0');
  });
  it('reports mixed outcomes without replaying writes after an injected lost response', async () => {
    const third = await client.create('project.task', {
      name: 'Uncertain outcome task',
      project_id: projectId,
      task_properties: { effort_key: 3 },
    });
    ids.push(third);
    const dispatched: number[] = [];
    const observed: Pick<OdooCrudClient, 'call' | 'read' | 'write'> = {
      call: client.call.bind(client),
      read: client.read.bind(client),
      write: async (model, recordIds, values, context) => {
        assert(typeof recordIds === 'number');
        dispatched.push(recordIds);
        if (recordIds === id(1))
          return client.write(model, recordIds, { field_that_does_not_exist: true }, context);
        const result = await client.write(model, recordIds, values, context);
        if (recordIds === third)
          throw new OdooNetworkError(
            'Injected lost response after server commit',
            new Error('Response discarded by test'),
          );
        return result;
      },
    };
    const scope = await createPropertiesScope(observed, 'project.task', 'task_properties', {
      parentId: projectId,
      concurrency: 2,
    });
    const tasks = scope.bind({ effort: { label: 'Estimated effort', type: 'float' } } as const);
    const receipt = await tasks.patchMany(ids, { effort: 0 });
    expect(receipt.map((result) => result.status)).toEqual(['acknowledged', 'failed', 'unknown']);
    expect(dispatched.sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
    expect(propertiesToWriteFormat(await raw(id())).effort_key).toBe(0);
    expect(propertiesToWriteFormat(await raw(id(1))).effort_key).toBe(2);
    // Unknown does not mean rejected: independent readback proves this write committed.
    expect(propertiesToWriteFormat(await raw(third)).effort_key).toBe(0);
  });
});
