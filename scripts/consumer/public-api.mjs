import assert from 'node:assert/strict';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectModulePrerequisites, OdooClient } from '@godoo-dev/client';
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
  const odoo = await startOdoo({ modules: ['base'], snapshot: false });
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
    writeFileSync(
      'runtime-proof.json',
      JSON.stringify(
        {
          observedMajor: info.major,
          server: info,
          odooContainerId: odoo.odooContainer.getId(),
          postgresContainerId: odoo.postgresContainer.getId(),
          modules: ['base'],
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
