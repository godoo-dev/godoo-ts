import assert from 'node:assert/strict';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPropertiesScope,
  getPropertyValue,
  inspectModulePrerequisites,
  OdooClient,
  propertiesToWriteFormat,
} from '@godoo-dev/client';
import { generateCompleteFile, Introspector } from '@godoo-dev/introspection';
import { normaliseOdooVersion, startOdoo } from '@godoo-dev/testcontainers';

const require = createRequire(import.meta.url);
const consumer = realpathSync(process.cwd());
const origins = {};
for (const name of ['client', 'introspection', 'testcontainers']) {
  const resolved = realpathSync(fileURLToPath(import.meta.resolve(`@godoo-dev/${name}`)));
  assert(
    !relative(consumer, resolved).startsWith('..'),
    `Package escaped isolated consumer: ${resolved}`,
  );
  assert(resolved.includes('/node_modules/'));
  origins[name] = resolved;
}
assert.equal(normaliseOdooVersion(undefined), '18.0');
const propertyRead = [
  { name: 'owner', type: 'many2one', value: [41, null] },
  {
    name: 'watchers',
    type: 'many2many',
    value: [
      [42, 'B'],
      [41, null],
    ],
  },
  { name: 'zero', type: 'integer', value: 0 },
  { name: 'clear', type: 'char', value: null },
  { name: 'section', type: 'separator' },
];
assert.deepEqual(propertiesToWriteFormat(propertyRead), {
  owner: 41,
  watchers: [42, 41],
  zero: 0,
  clear: null,
});
assert.deepEqual(getPropertyValue(propertyRead, 'owner'), [41, null]);
assert.throws(() =>
  propertiesToWriteFormat([{ name: 'invalid', type: 'many2one', value: [41, 42] }]),
);
const metadata = {
  model: { id: 1, name: 'Contact', model: 'res.partner', transient: false },
  fields: [
    {
      id: 1,
      model: 'res.partner',
      name: 'name',
      field_description: 'Name',
      ttype: 'char',
      required: true,
      readonly: false,
    },
  ],
};
writeFileSync('generated.ts', generateCompleteFile([metadata]));
assert.equal(typeof inspectModulePrerequisites, 'function');
assert.equal(
  typeof new Introspector(
    new OdooClient({
      url: 'http://127.0.0.1:1',
      database: 'disposable',
      username: 'admin',
      password: 'admin',
    }),
  ).getFields,
  'function',
);
console.log('GODOO_INSTALLED_ORIGINS ' + JSON.stringify(origins));
if (process.env.GODOO_INSTALLED_ODOO === 'true') {
  const odoo = await startOdoo({ modules: ['base', 'mail', 'project'], snapshot: false });
  try {
    const info = await odoo.client.getServerInfo();
    assert.equal(info.major, Number(process.env.ODOO_VERSION.split('.')[0]));
    const result = await inspectModulePrerequisites(odoo.client, ['base']);
    assert.equal(result.closureComplete, true);
    const introspector = new Introspector(odoo.client);
    const live = await introspector.getModelMetadata('res.partner');
    assert.equal(live.fields.find((f) => f.name === 'name')?.ttype, 'char');
    writeFileSync('generated.ts', generateCompleteFile([live]));
    const id = await odoo.client.create('res.partner', { name: 'Owned installed-candidate proof' });
    try {
      const [readback] = await odoo.client.read('res.partner', id, ['name']);
      assert.equal(readback?.name, 'Owned installed-candidate proof');
    } finally {
      await odoo.client.unlink('res.partner', id);
    }
    const partner = await odoo.client.create('res.partner', { name: 'Property codec proof' });
    const project = await odoo.client.create('project.project', {
      name: 'Installed property codec proof',
      task_properties_definition: [
        { name: 'owner', string: 'Owner', type: 'many2one', comodel: 'res.partner' },
        { name: 'watchers', string: 'Watchers', type: 'many2many', comodel: 'res.partner' },
        { name: 'count', string: 'Count', type: 'integer' },
        {
          name: 'priority',
          string: 'Priority',
          type: 'selection',
          selection: [
            ['high_id', 'High'],
            ['low_id', 'Low'],
          ],
        },
      ],
    });
    const taskIds = [];
    try {
      for (const name of ['First', 'Second']) {
        taskIds.push(
          await odoo.client.create('project.task', {
            name,
            project_id: project,
            task_properties: { owner: partner, watchers: [partner], count: 0, priority: 'low_id' },
          }),
        );
      }
      await odoo.client.properties.updateSafely('project.task', taskIds[0], 'task_properties', {
        count: 1,
      });
      await odoo.client.properties.updateSafelyBatch('project.task', taskIds, 'task_properties', {
        count: 2,
      });
      const rows = await odoo.client.read('project.task', taskIds, ['task_properties']);
      assert.equal(rows.length, 2);
      for (const row of rows) {
        assert.deepEqual(propertiesToWriteFormat(row.task_properties), {
          owner: partner,
          watchers: [partner],
          count: 2,
          priority: 'low_id',
        });
      }
      const scope = await createPropertiesScope(odoo.client, 'project.task', 'task_properties', {
        parentId: project,
        context: { lang: 'en_US' },
      });
      const tasks = scope.bind({
        priority: {
          label: 'Priority',
          type: 'selection',
          options: { high: { label: 'High' }, low: { label: 'Low' } },
        },
        count: { label: 'Count', type: 'integer' },
        reviewer: { label: 'Owner', type: 'many2one' },
      });
      const [before] = await tasks.read(taskIds);
      assert.equal(before.properties.priority, 'low');
      assert.equal(before.properties.reviewer, partner);
      assert.equal(Object.hasOwn(before, 'values'), false);
      const receipts = await tasks.patchEach(
        taskIds.map((id) => ({ id, changes: { priority: 'high', count: 0 } })),
      );
      assert(receipts.every((receipt) => receipt.status === 'acknowledged'));
      for (const row of await tasks.read(taskIds)) {
        assert.equal(row.properties.priority, 'high');
        assert.equal(row.properties.count, 0);
        assert.equal(row.properties.reviewer, partner);
        assert.deepEqual(propertiesToWriteFormat(row.raw).watchers, [partner]);
      }
      const serviceScope = await odoo.client.properties.scope('project.task', 'task_properties', {
        parentId: project,
      });
      const counts = serviceScope.bind({ count: { id: 'count', type: 'integer' } });
      assert.equal((await counts.patch(taskIds[0], { count: null })).status, 'acknowledged');
      assert.equal((await counts.read([taskIds[0]]))[0].properties.count, null);
    } finally {
      if (taskIds.length) await odoo.client.unlink('project.task', taskIds);
      await odoo.client.unlink('project.project', project);
      await odoo.client.unlink('res.partner', partner);
    }
    writeFileSync(
      'runtime-proof.json',
      JSON.stringify(
        {
          observedMajor: info.major,
          server: info,
          odooContainerId: odoo.odooContainer.getId(),
          postgresContainerId: odoo.postgresContainer.getId(),
          modules: ['base', 'mail', 'project'],
          origins,
        },
        null,
        2,
      ),
    );
  } finally {
    await odoo.cleanup();
  }
}
// Resolve compiler from the installed consumer, never the source workspace.
console.log('GODOO_INSTALLED_COMPILER ' + require.resolve('typescript/bin/tsc'));
assert(
  readFileSync(join(consumer, 'generated.ts'), 'utf8').includes('export interface ResPartner'),
);
