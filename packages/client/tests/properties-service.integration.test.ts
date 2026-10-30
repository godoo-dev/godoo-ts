import assert from 'node:assert/strict';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ModuleManager, OdooClient } from '../src/index.js';
import {
  getPropertyValue,
  type PropertiesDefinition,
  type PropertiesReadFormat,
} from '../src/types/properties.js';

/**
 * Properties service integration tests using the project module.
 *
 * Tests the new `client.properties.*` service accessors for safe property updates.
 */
describe('Properties Service Integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  let moduleManager: ModuleManager;
  let projectId: number;
  let taskId: number;
  let moduleWasInstalled = false;

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
    });

    await client.authenticate();
    moduleManager = new ModuleManager(client);

    // Install project module if not already installed
    const isInstalled = await moduleManager.isModuleInstalled('project');
    if (!isInstalled) {
      await moduleManager.installModule('project');
      moduleWasInstalled = true;
    }

    // Create a test project with properties definition
    projectId = await client.create('project.project', {
      name: 'Test Project for Properties Service',
    });

    await client.write('project.project', projectId, {
      task_properties_definition: [
        {
          name: 'priority',
          string: 'Priority',
          type: 'selection',
          selection: [
            ['low', 'Low'],
            ['high', 'High'],
          ],
        },
        {
          name: 'score',
          string: 'Score',
          type: 'integer',
        },
        {
          name: 'active_flag',
          string: 'Active',
          type: 'boolean',
        },
      ],
    });

    // Create test task with initial properties
    taskId = await client.create('project.task', {
      name: 'Test Task',
      project_id: projectId,
      task_properties: {
        priority: 'low',
        score: 50,
        active_flag: true,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (taskId) {
      try {
        await client.unlink('project.task', taskId);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (projectId) {
      try {
        await client.unlink('project.project', projectId);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (moduleWasInstalled) {
      try {
        await moduleManager.uninstallModule('project');
      } catch {
        // Ignore cleanup errors
      }
    }

    client.logout();
  });

  describe('client.properties.updateSafely', () => {
    it('should update single property and preserve others', async () => {
      // Update only priority
      await client.properties.updateSafely('project.task', taskId, 'task_properties', {
        priority: 'high',
      });

      // Read back and verify
      const [task] = await client.read<{ task_properties: PropertiesReadFormat }>(
        'project.task',
        [taskId],
        ['task_properties'],
      );
      assert(task !== undefined);
      const props = Object.fromEntries(task.task_properties.map((p) => [p.name, p.value]));

      expect(props.priority).toBe('high'); // Updated
      expect(props.score).toBe(50); // Preserved
      expect(props.active_flag).toBe(true); // Preserved
    });
  });

  describe('client.properties.getCurrentWriteFormat', () => {
    it('should return current properties in write format', async () => {
      const current = await client.properties.getCurrentWriteFormat(
        'project.task',
        taskId,
        'task_properties',
      );

      expect(current).toEqual({
        priority: 'high', // From previous test
        score: 50,
        active_flag: true,
      });
    });
  });

  describe('client.properties.updateSafelyBatch', () => {
    it('should handle empty array gracefully', async () => {
      await expect(
        client.properties.updateSafelyBatch('project.task', [], 'task_properties', {
          priority: 'high',
        }),
      ).resolves.toBeUndefined();
    });
  });
});

/** Independent fixtures: none of these assertions depends on a previous test. */
describe('Properties relational read/merge/write integration', () => {
  let client: OdooClient;
  let moduleManager: ModuleManager;
  let installedProject = false;
  let projectId: number | undefined;
  let partnerIds: number[] = [];
  let taskIds: number[] = [];
  const partnerNames = ['Properties codec partner A', 'Properties codec partner B'];

  beforeAll(async () => {
    client = new OdooClient({
      url: process.env.ODOO_URL || 'http://localhost:8069',
      database: process.env.ODOO_DB_NAME || 'odoo',
      username: process.env.ODOO_DB_USER || 'admin',
      password: process.env.ODOO_DB_PASSWORD || 'admin',
    });
    await client.authenticate();
    moduleManager = new ModuleManager(client);
    if (!(await moduleManager.isModuleInstalled('project'))) {
      await moduleManager.installModule('project');
      installedProject = true;
    }
  });

  beforeEach(async () => {
    partnerIds = [];
    taskIds = [];
    projectId = undefined;
    for (const name of partnerNames) partnerIds.push(await client.create('res.partner', { name }));
    const definitions: PropertiesDefinition = [
      { name: 'owner', string: 'Owner', type: 'many2one', comodel: 'res.partner' },
      { name: 'watchers', string: 'Watchers', type: 'many2many', comodel: 'res.partner' },
      { name: 'zero', string: 'Zero', type: 'integer' },
      { name: 'float_zero', string: 'Float zero', type: 'float' },
      { name: 'active', string: 'Active', type: 'boolean' },
      { name: 'text', string: 'Text', type: 'char' },
      { name: 'marker', string: 'Marker', type: 'char' },
      {
        name: 'choice',
        string: 'Choice',
        type: 'selection',
        selection: [
          ['low', 'Low'],
          ['high', 'High'],
        ],
      },
      {
        name: 'tags',
        string: 'Tags',
        type: 'tags',
        tags: [
          ['red', 'Red', 1],
          ['blue', 'Blue', 2],
        ],
      },
      { name: 'empty_tags', string: 'Empty tags', type: 'tags', tags: [['red', 'Red', 1]] },
      { name: 'unset_date', string: 'Unset date', type: 'date' },
      { name: 'section', string: 'Section', type: 'separator' },
    ];
    projectId = await client.create('project.project', {
      name: 'Properties codec isolated fixture',
      task_properties_definition: definitions,
    });
    for (let index = 0; index < 2; index++) {
      const task = await client.create('project.task', {
        name: `Properties codec task ${index}`,
        project_id: projectId,
      });
      taskIds.push(task);
      // Exercise empty inputs too; this Odoo task flow returns them as false.
      await client.write('project.task', task, {
        task_properties: {
          owner: partnerIds[index],
          watchers: index === 0 ? partnerIds : [partnerIds[1]],
          zero: 0,
          float_zero: 0,
          active: false,
          text: '',
          marker: 'before',
          choice: index === 0 ? 'low' : 'high',
          tags: index === 0 ? ['red'] : ['blue'],
          empty_tags: [],
          unset_date: null,
        },
      });
    }
  });

  afterEach(async () => {
    try {
      if (taskIds.length) await client.unlink('project.task', taskIds);
    } finally {
      try {
        if (projectId !== undefined) await client.unlink('project.project', projectId);
      } finally {
        if (partnerIds.length) await client.unlink('res.partner', partnerIds);
      }
    }
  });

  afterAll(async () => {
    try {
      if (installedProject) await moduleManager.uninstallModule('project');
    } finally {
      client.logout();
    }
  });

  function taskId(index: number): number {
    const id = taskIds[index];
    assert(id !== undefined);
    return id;
  }

  async function readRaw(index: number): Promise<PropertiesReadFormat> {
    const [record] = await client.read<{ task_properties: PropertiesReadFormat }>(
      'project.task',
      [taskId(index)],
      ['task_properties'],
    );
    assert(record !== undefined);
    return record.task_properties;
  }

  function expectPreserved(raw: PropertiesReadFormat, index: number, marker: string) {
    // These assertions inspect fresh RPC reads directly, without the converter.
    expect(getPropertyValue(raw, 'owner')).toEqual([partnerIds[index], partnerNames[index]]);
    expect(getPropertyValue(raw, 'watchers')).toEqual(
      index === 0
        ? [
            [partnerIds[0], partnerNames[0]],
            [partnerIds[1], partnerNames[1]],
          ]
        : [[partnerIds[1], partnerNames[1]]],
    );
    expect(getPropertyValue(raw, 'zero')).toBe(0);
    expect(getPropertyValue(raw, 'float_zero')).toBe(0);
    expect(getPropertyValue(raw, 'active')).toBe(false);
    expect(getPropertyValue(raw, 'text')).toBe(false);
    expect(getPropertyValue(raw, 'marker')).toBe(marker);
    expect(getPropertyValue(raw, 'choice')).toBe(index === 0 ? 'low' : 'high');
    expect(getPropertyValue(raw, 'tags')).toEqual(index === 0 ? ['red'] : ['blue']);
    expect(getPropertyValue(raw, 'empty_tags')).toBe(false);
    expect(getPropertyValue(raw, 'unset_date')).toBe(false);
    expect(raw.find((property) => property.name === 'section')?.type).toBe('separator');
  }

  it('preserves actual relation tuples and untouched values after a single update', async () => {
    expectPreserved(await readRaw(0), 0, 'before');
    const current = await client.properties.getCurrentWriteFormat(
      'project.task',
      taskId(0),
      'task_properties',
    );
    expect(current.owner).toBe(partnerIds[0]);
    expect(current.watchers).toEqual(partnerIds);
    expect(Object.hasOwn(current, 'section')).toBe(false);

    await client.properties.updateSafely('project.task', taskId(0), 'task_properties', {
      marker: 'single',
    });

    expectPreserved(await readRaw(0), 0, 'single');
    expectPreserved(await readRaw(1), 1, 'before');
  });

  it('preserves each record independently after a nonempty two-record batch update', async () => {
    expectPreserved(await readRaw(0), 0, 'before');
    expectPreserved(await readRaw(1), 1, 'before');

    await client.properties.updateSafelyBatch('project.task', taskIds, 'task_properties', {
      marker: 'batch',
    });

    expectPreserved(await readRaw(0), 0, 'batch');
    expectPreserved(await readRaw(1), 1, 'batch');
  });

  it('supports explicit clears and demonstrates direct dictionary replacement on omission', async () => {
    await client.properties.updateSafely('project.task', taskId(0), 'task_properties', {
      owner: false,
      watchers: [],
      tags: [],
      choice: false,
      text: false,
      unset_date: null,
    });
    const cleared = await readRaw(0);
    expect(getPropertyValue(cleared, 'owner')).toBe(false);
    expect(getPropertyValue(cleared, 'watchers')).toBe(false);
    expect(getPropertyValue(cleared, 'tags')).toBe(false);
    expect(getPropertyValue(cleared, 'choice')).toBe(false);
    expect(getPropertyValue(cleared, 'text')).toBe(false);
    expect(getPropertyValue(cleared, 'unset_date')).toBe(false);
    expect(getPropertyValue(cleared, 'zero')).toBe(0);
    expect(getPropertyValue(cleared, 'float_zero')).toBe(0);
    expect(getPropertyValue(cleared, 'marker')).toBe('before');
    expectPreserved(await readRaw(1), 1, 'before');

    // A direct dictionary write replaces other keys instead of merging them.
    await client.write('project.task', taskId(1), { task_properties: { marker: 'direct' } });
    const replaced = await readRaw(1);
    expect(getPropertyValue(replaced, 'marker')).toBe('direct');
    expect(getPropertyValue(replaced, 'owner')).toBe(false);
    expect(getPropertyValue(replaced, 'watchers')).toBe(false);
    expect(getPropertyValue(replaced, 'tags')).toBe(false);
    expect(getPropertyValue(replaced, 'choice')).toBe(false);
    expect(getPropertyValue(replaced, 'zero')).toBe(false);
    expect(getPropertyValue(replaced, 'text')).toBe(false);
  });
});
