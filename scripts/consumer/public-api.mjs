import assert from 'node:assert/strict';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPropertiesScope,
  getPropertyValue,
  inspectModulePrerequisites,
  ModuleLifecycleError,
  OdooAccessError,
  OdooClient,
  OdooRpcError,
  PropertiesBindingError,
  propertiesToWriteFormat,
  READ_METHODS,
  setDefaultSafetyContext,
} from '@godoo-dev/client';
import {
  createBoundClient,
  PropertiesBindingError as PortableBindingError,
  ModuleLifecycleError as PortableLifecycleError,
  OdooRpcError as PortableRpcError,
  READ_METHODS as portableReadMethods,
} from '@godoo-dev/client/portable';
import { generateCompleteFile as formatCompleteFile } from '@godoo-dev/introspection/formatters';
import { Introspector } from '@godoo-dev/introspection/portable';
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
assert.equal(OdooRpcError, PortableRpcError);
assert.equal(PropertiesBindingError, PortableBindingError);
assert.equal(ModuleLifecycleError, PortableLifecycleError);
assert.equal(READ_METHODS, portableReadMethods);
assert(new OdooAccessError('denied by host') instanceof PortableRpcError);
setDefaultSafetyContext({ confirm: async () => false });
try {
  await assert.rejects(
    createBoundClient({
      rpc: async () => {
        throw new Error('Host must not be reached');
      },
    }).create('res.partner', {}),
    { name: 'OdooSafetyError' },
  );
} finally {
  setDefaultSafetyContext(null);
}
const definitions = [{ name: 'count', string: 'Count', type: 'integer' }];
const hostErrorClient = createBoundClient({
  async rpc(model, method, args) {
    if (method === 'fields_get')
      return args[0][0] === 'task_properties'
        ? {
            task_properties: {
              type: 'properties',
              definition_record: 'project_id',
              definition_record_field: 'task_properties_definition',
            },
          }
        : { project_id: { type: 'many2one', relation: 'project.project' } };
    if (method === 'read')
      return model === 'project.project'
        ? [{ id: 7, task_properties_definition: definitions }]
        : [
            {
              id: 3,
              project_id: [7, 'Project'],
              task_properties: [{ ...definitions[0], value: 2 }],
            },
          ];
    throw new OdooAccessError('Denied by direct host client');
  },
});
const hostErrorScope = await hostErrorClient.properties.scope('project.task', 'task_properties', {
  parentId: 7,
});
assert.equal(
  (await hostErrorScope.bind({ count: { id: 'count', type: 'integer' } }).patch(3, { count: 0 }))
    .status,
  'failed',
);
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
writeFileSync('generated.ts', formatCompleteFile([metadata]));
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
    const hostClient = odoo.client;
    const client = createBoundClient({
      rpc: (model, method, args, kwargs) => hostClient.call(model, method, args, kwargs),
      session: { uid: hostClient.getSession().uid },
    });
    const info = await hostClient.getServerInfo();
    assert.equal(info.major, Number(process.env.ODOO_VERSION.split('.')[0]));
    const restrictedLogin = 'installed-bound-acl-proof';
    const restrictedPassword = 'disposable-acl-proof-password';
    const restrictedUser = await hostClient.create('res.users', {
      name: 'Disposable bound ACL proof',
      login: restrictedLogin,
      password: restrictedPassword,
      groups_id: [[6, 0, []]],
    });
    const restrictedHost = new OdooClient({
      url: odoo.url,
      database: odoo.database,
      username: restrictedLogin,
      password: restrictedPassword,
    });
    try {
      await restrictedHost.authenticate();
      const restrictedBound = createBoundClient({
        rpc: (model, method, args, kwargs) => restrictedHost.call(model, method, args, kwargs),
        session: { uid: restrictedUser },
      });
      await assert.rejects(
        restrictedBound.searchRead('ir.config_parameter', [], { fields: ['key'], limit: 1 }),
        OdooAccessError,
      );
    } finally {
      restrictedHost.logout();
      await hostClient.unlink('res.users', restrictedUser);
    }
    const result = await inspectModulePrerequisites(client, ['base']);
    assert.equal(result.closureComplete, true);
    const introspector = new Introspector(client);
    const live = await introspector.getModelMetadata('res.partner');
    assert.equal(live.fields.find((f) => f.name === 'name')?.ttype, 'char');
    writeFileSync('generated.ts', formatCompleteFile([live]));
    const id = await client.create('res.partner', { name: 'Owned installed-candidate proof' });
    try {
      const [readback] = await client.read('res.partner', id, ['name']);
      assert.equal(readback?.name, 'Owned installed-candidate proof');
    } finally {
      await client.unlink('res.partner', id);
    }
    const partner = await client.create('res.partner', { name: 'Property codec proof' });
    const project = await client.create('project.project', {
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
          await client.create('project.task', {
            name,
            project_id: project,
            task_properties: { owner: partner, watchers: [partner], count: 0, priority: 'low_id' },
          }),
        );
      }
      // Force real tracking events, then cross multiple nonempty pages through
      // the installed bound SDK. An empty feed cannot satisfy this assertion.
      for (const name of ['Tracked first', 'Tracked second', 'Tracked third']) {
        await client.write('project.task', taskIds[0], { name });
      }
      const liveCdc = [];
      for await (const event of client.cdc.getFeed('project.task', {
        pageSize: 1,
        domain: [['mail_message_id.res_id', '=', taskIds[0]]],
      })) {
        liveCdc.push(event);
      }
      assert(liveCdc.length >= 3, 'Expected nonempty multi-page tracking history');
      assert(liveCdc.some((event) => event.field.name === 'name'));
      assert(liveCdc.every((event, index) => index === 0 || event.id > liveCdc[index - 1].id));
      await client.properties.updateSafely('project.task', taskIds[0], 'task_properties', {
        count: 1,
      });
      await client.properties.updateSafelyBatch('project.task', taskIds, 'task_properties', {
        count: 2,
      });
      const rows = await client.read('project.task', taskIds, ['task_properties']);
      assert.equal(rows.length, 2);
      for (const row of rows) {
        assert.deepEqual(propertiesToWriteFormat(row.task_properties), {
          owner: partner,
          watchers: [partner],
          count: 2,
          priority: 'low_id',
        });
      }
      const scope = await createPropertiesScope(client, 'project.task', 'task_properties', {
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
      // Independent direct readback checks the bound client's writes.
      const [independent] = await hostClient.read('project.task', taskIds[0], ['task_properties']);
      assert.equal(propertiesToWriteFormat(independent.task_properties).count, 0);
      const serviceScope = await client.properties.scope('project.task', 'task_properties', {
        parentId: project,
      });
      const counts = serviceScope.bind({ count: { id: 'count', type: 'integer' } });
      assert.equal((await counts.patch(taskIds[0], { count: null })).status, 'acknowledged');
      assert.equal((await counts.read([taskIds[0]]))[0].properties.count, null);
      const created = await tasks.create(
        { name: 'Installed friendly creation' },
        {
          priority: 'high',
          count: 0,
          reviewer: partner,
        },
      );
      taskIds.push(created);
      const [createdRaw] = await client.read('project.task', created, [
        'name',
        'project_id',
        'task_properties',
      ]);
      assert.equal(createdRaw.name, 'Installed friendly creation');
      assert.equal(createdRaw.project_id[0], project);
      assert.deepEqual(propertiesToWriteFormat(createdRaw.task_properties), {
        owner: partner,
        watchers: false,
        count: 0,
        priority: 'high_id',
      });
      assert.deepEqual((await tasks.read([created]))[0].properties, {
        priority: 'high',
        count: 0,
        reviewer: partner,
      });
    } finally {
      if (taskIds.length) await client.unlink('project.task', taskIds);
      await client.unlink('project.project', project);
      await client.unlink('res.partner', partner);
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
          boundClient: true,
          restrictedUserAclDenied: true,
          nonemptyBoundCdcPagination: true,
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
