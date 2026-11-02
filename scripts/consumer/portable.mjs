import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule } from 'node:vm';

// Evaluate the exact installed portable graph with no Node globals or network.
// Every dependency must be a relative ESM file: external Node backends fail here.
const context = createContext({ structuredClone, URLSearchParams, setTimeout, clearTimeout });
const modules = new Map();
function load(url) {
  if (modules.has(url)) return modules.get(url);
  const module = new SourceTextModule(readFileSync(fileURLToPath(url), 'utf8'), {
    context,
    identifier: url,
  });
  modules.set(url, module);
  return module;
}
async function linker(specifier, from) {
  assert(specifier.startsWith('.'), `Nonportable runtime dependency: ${specifier}`);
  return load(new URL(specifier, from.identifier).href);
}
const entries = {};
for (const name of [
  '@godoo-dev/client/portable',
  '@godoo-dev/client/effects',
  '@godoo-dev/client/reference',
  '@godoo-dev/introspection/portable',
  '@godoo-dev/introspection/formatters',
]) {
  const module = load(import.meta.resolve(name));
  if (module.status === 'unlinked') await module.link(linker);
  if (module.status !== 'evaluated') await module.evaluate();
  entries[name] = module.namespace;
}
const { createBoundClient } = entries['@godoo-dev/client/portable'];
const { Introspector } = entries['@godoo-dev/introspection/portable'];
const { generateModelInterface } = entries['@godoo-dev/introspection/formatters'];
const { resolveRpcEffects, EFFECTS } = entries['@godoo-dev/client/effects'];
const { SDK_REFERENCE, getSdkReference } = entries['@godoo-dev/client/reference'];
const plain = (value) => JSON.parse(JSON.stringify(value));
const calls = [];
const row = (id) => ({
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
  mail_message_id: [200 + id, 'res.partner,1'],
  create_date: '2026-01-15 10:00:00',
});
const pages = [[row(1), row(2)], [row(3)]];
const client = createBoundClient({
  session: { uid: 7, session_id: 'excluded-session' },
  async rpc(model, method, args, kwargs) {
    calls.push({ model, method, args: plain(args), kwargs: plain(kwargs) });
    if (model === 'mail.tracking.value') return pages.shift() ?? [];
    if (model === 'mail.message')
      return args[0].map((id) => ({
        id,
        res_id: 1,
        date: '2026-01-15 10:00:00',
        author_id: [7, 'Author'],
      }));
    if (model === 'ir.model')
      return [{ id: 1, name: 'Contact', model: 'res.partner', transient: false }];
    if (model === 'ir.model.fields')
      return [
        {
          id: 10,
          name: 'name',
          model: 'res.partner',
          ttype: 'char',
          field_description: 'Name',
          required: true,
          readonly: false,
        },
      ];
    if (method === 'fields_get') return { name: { type: 'char', translate: true } };
    if (method === 'create') return 41;
    if (method === 'write' || method === 'unlink') return true;
    if (method === 'search_count') return 1;
    if (method === 'search') return [41];
    return [{ id: 41, name: 'Portable contact' }];
  },
});
assert.deepEqual(plain(client.getSession()), { uid: 7 });
assert.equal('authenticate' in client, false);
assert.equal(client.accounting, client.accounting);
assert.equal(client.modules.catalogRevision, 0);
assert.equal(
  client.accounting.isClosingEntryFromLines([{ account_id: [1, '129000 Closing'] }]),
  true,
);
assert.equal(await client.create('res.partner', { name: 'Portable' }), 41);
assert.equal(await client.write('res.partner', 41, { name: 'Updated' }), true);
assert.deepEqual(plain(await client.search('res.partner')), [41]);
assert.equal((await client.read('res.partner', 41))[0].name, 'Portable contact');
assert.equal((await client.searchRead('res.partner'))[0].id, 41);
assert.equal(await client.searchCount('res.partner'), 1);
assert.equal(await client.unlink('res.partner', 41), true);
await client.call('res.partner', 'custom', [], {}, { safetyLevel: 'READ' });
assert(calls.every((call) => !Object.hasOwn(call.kwargs, 'safetyLevel')));
const introspector = new Introspector(client);
const metadata = await introspector.getModelMetadata('res.partner');
assert.equal(await introspector.getModelMetadata('res.partner'), metadata);
const attributes = await introspector.getFieldAttributes('res.partner');
assert.equal(Object.prototype.toString.call(attributes), '[object Map]');
assert.equal(attributes.get('name').translate, true);
assert.equal(await introspector.getFieldAttributes('res.partner'), attributes);
introspector.clearModelCache('res.partner');
assert.notEqual(await introspector.getFieldAttributes('res.partner'), attributes);
assert(generateModelInterface(metadata).includes('export interface ResPartner'));
const events = [];
for await (const event of client.cdc.getFeed('res.partner', { pageSize: 2, since: '2026-01-01' }))
  events.push(event);
assert.deepEqual(
  events.map((event) => event.id),
  [1, 2, 3],
);
const tracking = calls.filter((call) => call.model === 'mail.tracking.value');
assert(tracking[1].args[0].some((clause) => JSON.stringify(clause) === '["id",">",2]'));
assert.deepEqual(plain(resolveRpcEffects('res.partner', 'read')), plain(EFFECTS));
assert.equal(SDK_REFERENCE.effectContractVersion, 1);
assert(
  getSdkReference('properties').helpers.some((entry) => entry.path === 'properties.binding.create'),
);
const globals = new SourceTextModule(
  'export default [typeof process, typeof Buffer, typeof fetch, typeof require];',
  { context },
);
await globals.link(linker);
await globals.evaluate();
assert.deepEqual(plain(globals.namespace.default), [
  'undefined',
  'undefined',
  'undefined',
  'undefined',
]);
console.log(
  'GODOO_PORTABLE_PROOF ' +
    JSON.stringify({
      modules: modules.size,
      nodeGlobals: false,
      network: false,
      cdcEvents: events.length,
      entrypoints: Object.keys(entries),
    }),
);
