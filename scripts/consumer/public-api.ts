import {
  createPropertiesScope,
  type Domain,
  getPropertyValue,
  inspectModulePrerequisites,
  OdooClient,
  type OdooCrudClient,
  type PropertiesDeclarations,
  type PropertiesReadFormat,
  type PropertiesWriteFormat,
  type PropertyReadValueType,
  propertiesToWriteFormat,
} from '@godoo-dev/client';
import { generateCompleteFile, Introspector, type ModelMetadata } from '@godoo-dev/introspection';
import {
  normaliseOdooVersion,
  type OdooTestContainerOptions,
  type StartedOdooContainer,
  startOdoo,
} from '@godoo-dev/testcontainers';

const client: OdooCrudClient = new OdooClient({
  url: 'http://127.0.0.1:1',
  database: 'disposable',
  username: 'admin',
  password: 'admin',
});
const domain: Domain = [['name', '=', 'Example']];
const options: OdooTestContainerOptions = { modules: ['base'], snapshot: false };
const provision: (options?: OdooTestContainerOptions) => Promise<StartedOdooContainer> = startOdoo;
const introspector = new Introspector(client as OdooClient);
const propertyRead: PropertiesReadFormat = [
  { name: 'owner', string: 'Owner', type: 'many2one', comodel: 'res.partner', value: [41, null] },
  {
    name: 'watchers',
    string: 'Watchers',
    type: 'many2many',
    comodel: 'res.partner',
    value: [[42, 'B']],
  },
  { name: 'tags', string: 'Tags', type: 'tags', tags: [['ready', 'Ready', 1]], value: ['ready'] },
  { name: 'clear', string: 'Clear', type: 'integer', value: null },
];
export const propertyWrite: PropertiesWriteFormat = propertiesToWriteFormat(propertyRead);
export const propertyRaw: PropertyReadValueType = getPropertyValue(propertyRead, 'owner');
// Relation display tuples belong to RPC reads, never dictionary writes.
// @ts-expect-error A display tuple is not a property dictionary-write value.
const invalidPropertyWrite: PropertiesWriteFormat = { owner: [41, 'Display name'] };
void invalidPropertyWrite;
export const publicTypes = {
  client,
  domain,
  options,
  provision,
  introspector,
  normaliseOdooVersion,
  inspectModulePrerequisites,
};
export const generate: (metadata: ModelMetadata[]) => string = generateCompleteFile;

// Installed consumer: declarations must preserve exact keys and application aliases.
export async function propertyBindingsConsumer(crud: OdooCrudClient) {
  const scope = await createPropertiesScope(crud, 'project.task', 'task_properties', {
    parentId: 1,
  });
  const tasks = scope.bind({
    priority: {
      label: 'Priority',
      type: 'selection',
      options: { high: { label: 'High' }, low: { id: 'low_key' } },
    },
    labels: { id: 'labels_key', type: 'tags', options: { ready: { label: 'Ready' } } },
    effort: { label: 'Effort', type: 'float' },
    reviewer: { label: 'Reviewer', type: 'many2one', comodel: 'res.partner' },
    active: { label: 'Active', type: 'boolean' },
  } as const);
  const [task] = await tasks.read([1]);
  if (task) {
    const priority: 'high' | 'low' | null = task.properties.priority;
    const labels: Array<'ready'> | null = task.properties.labels;
    const effort: number | null = task.properties.effort;
    const reviewer: number | null = task.properties.reviewer;
    const active: boolean | null = task.properties.active;
    void [priority, labels, effort, reviewer, active];
    // @ts-expect-error Read results consistently expose properties.
    void task.values;
    // @ts-expect-error Exact inferred keys reject unknown properties.
    void task.properties.unknown;
  }
  await tasks.patch(1, {
    priority: 'high',
    effort: 0,
    labels: ['ready'],
    reviewer: 2,
    active: false,
  });
  await tasks.patchMany([1, 2], { priority: null, labels: [] });
  await tasks.patchEach([
    { id: 1, changes: { effort: 0 } },
    { id: 2, changes: { reviewer: null } },
  ]);
  const createdId: number = await tasks.create(
    { name: 'New task' },
    {
      priority: 'high',
      effort: 0,
      labels: ['ready'],
      reviewer: 2,
      active: false,
    },
  );
  await tasks.read([createdId]);
  await tasks.create({ name: 'Default properties' });
  // @ts-expect-error Creation retains the exact option alias union.
  await tasks.create({ name: 'Invalid' }, { priority: 'urgent' });
  // @ts-expect-error Creation rejects unknown property aliases.
  await tasks.create({}, { unknown: 0 });
  // @ts-expect-error Creation validates declared numeric types.
  await tasks.create({}, { effort: 'zero' });
  // @ts-expect-error Creation retains exact tags aliases.
  await tasks.create({}, { labels: ['unmapped'] });
  // @ts-expect-error Selection aliases are inferred, not arbitrary strings.
  await tasks.patch(1, { priority: 'urgent' });
  // @ts-expect-error Tags use inferred option aliases.
  await tasks.patch(1, { labels: ['unmapped'] });
  // @ts-expect-error Declared numeric types reject strings.
  await tasks.patch(1, { effort: 'zero' });
  // @ts-expect-error Unknown patch keys are rejected.
  await tasks.patch(1, { unknown: 0 });
  // @ts-expect-error Selectors must choose either an ID or a label.
  scope.bind({ effort: { id: 'effort', label: 'Effort', type: 'float' } });
  // @ts-expect-error Selection bindings require an option map.
  scope.bind({ priority: { label: 'Priority', type: 'selection' } });
}

// These declarations may come from runtime configuration rather than literals.
async function unionPropertyContract(
  scope: Awaited<ReturnType<typeof createPropertiesScope>>,
  kind: 'float' | 'boolean',
  optionKind: 'selection' | 'tags',
  declarations: PropertiesDeclarations,
) {
  const binding = scope.bind({ effort: { id: 'n', type: kind } });
  const [row] = await binding.read([1]);
  if (row) {
    const effort: number | boolean | null = row.properties.effort;
    void effort;
    // @ts-expect-error A union-valued kind can return a number or boolean.
    const text: string | null = row.properties.effort;
    void text;
  }
  await binding.patch(1, { effort: 0 });
  await binding.patch(1, { effort: false });
  // @ts-expect-error Neither float nor boolean accepts text.
  await binding.patch(1, { effort: 'text' });
  const options = scope.bind({
    choice: { id: 'p', type: optionKind, options: { ready: { id: 'r' } } },
  });
  const [optionRow] = await options.read([1]);
  if (optionRow) {
    const choice: 'ready' | Array<'ready'> | null = optionRow.properties.choice;
    void choice;
  }
  await options.patch(1, { choice: 'ready' });
  await options.patch(1, { choice: ['ready'] });
  // @ts-expect-error Both option kinds retain their exact alias keys.
  await options.patch(1, { choice: 'other' });
  const broad = scope.bind(declarations);
  const [broadRow] = await broad.read([1]);
  if (broadRow) {
    const value: string | number | boolean | string[] | number[] | null | undefined =
      broadRow.properties.anyAlias;
    void value;
    // @ts-expect-error An annotated map can contain non-string property kinds.
    const text: string | null | undefined = broadRow.properties.anyAlias;
    void text;
  }
  await broad.patch(1, { numeric: 1, boolean: false, relation: [1], text: 'text' });
  // @ts-expect-error No supported property kind accepts objects.
  await broad.patch(1, { invalid: {} });
}
void unionPropertyContract;
