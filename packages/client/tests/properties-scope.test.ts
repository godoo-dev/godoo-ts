import assert from 'node:assert/strict';
import { describe, expect, it, vi } from 'vitest';
import { required } from '../../../scripts/test-assertions.js';
import {
  createPropertiesScope,
  type OAuthProxyClient,
  OdooClient,
  OdooNetworkError,
  OdooProtocolError,
  OdooRpcError,
  OdooSafetyError,
  OdooTimeoutError,
  OdooValidationError,
  PropertiesBindingError,
  type PropertiesClient,
  type PropertiesDeclarations,
  type PropertiesScopeOptions,
} from '../src/index';

const schema = (): Record<string, unknown>[] => [
  {
    name: 'p',
    string: 'Priority',
    type: 'selection',
    selection: [
      ['hi', 'High'],
      ['lo', 'Low'],
      ['other', 'Other'],
    ],
  },
  { name: 'n', string: 'Effort', type: 'float', default: 9 },
  { name: 'i', string: 'Count', type: 'integer' },
  { name: 'b', string: 'Done', type: 'boolean' },
  { name: 's', string: 'Text', type: 'char' },
  { name: 'd', string: 'Date', type: 'date' },
  { name: 'dt', string: 'Time', type: 'datetime' },
  { name: 'one', string: 'Owner', type: 'many2one', comodel: 'res.partner' },
  { name: 'many', string: 'People', type: 'many2many', comodel: 'res.partner' },
  {
    name: 't',
    string: 'Tags',
    type: 'tags',
    tags: [
      ['red', 'Red', 1],
      ['blue', 'Blue', 2],
    ],
  },
  { name: 'sep', string: 'Section', type: 'separator' },
];
const declaration = {
  priority: {
    label: 'Priority',
    type: 'selection',
    options: { high: { label: 'High' }, low: { id: 'lo' } },
  },
  estimate: { label: 'Effort', type: 'float' },
} as const;
const allDeclarations = {
  ...declaration,
  count: { id: 'i', type: 'integer' },
  done: { id: 'b', type: 'boolean' },
  text: { id: 's', type: 'char' },
  date: { id: 'd', type: 'date' },
  time: { id: 'dt', type: 'datetime' },
  owner: { id: 'one', type: 'many2one', comodel: 'res.partner' },
  people: { id: 'many', type: 'many2many' },
  tags: { id: 't', type: 'tags', options: { red: { id: 'red' } } },
} as const;

function fixture() {
  let defs = schema();
  const current = new Map<string, unknown>([
    ['p', 'hi'],
    ['n', 3],
    ['i', 2],
    ['b', false],
    ['s', 'text'],
    ['d', '2026-10-29'],
    ['dt', '2026-10-29 11:23:45'],
    ['one', [12, null]],
    [
      'many',
      [
        [12, 'A'],
        [13, null],
      ],
    ],
    ['t', ['blue']],
  ]);
  const raw = () =>
    defs.map((def) =>
      def.type === 'separator'
        ? structuredClone(def)
        : { ...structuredClone(def), value: structuredClone(current.get(def.name as string)) },
    );
  const row = (id: number, parentId = 7) => ({
    id,
    task_properties: raw(),
    project_id: [parentId, 'Project'],
  });
  const call = vi.fn<PropertiesClient['call']>(async (_model, method, args) => {
    if (method === 'create') return 41 as never;
    const fields = args?.[0] as string[];
    return (
      fields[0] === 'task_properties'
        ? {
            task_properties: {
              type: 'properties',
              definition_record: 'project_id',
              definition_record_field: 'task_properties_definition',
              extra: { nested: [1] },
            },
          }
        : { project_id: { type: 'many2one', relation: 'project.project' } }
    ) as never;
  });
  const read = vi.fn<PropertiesClient['read']>(
    async (model, ids) =>
      (model === 'project.project'
        ? [{ id: 7, task_properties_definition: structuredClone(defs) }]
        : (Array.isArray(ids) ? ids : [ids]).map((id) => row(id))) as never,
  );
  const write = vi.fn<PropertiesClient['write']>(async () => true);
  const client: PropertiesClient = {
    call: call as PropertiesClient['call'],
    read: read as PropertiesClient['read'],
    write,
  };
  const scope = (options: Partial<PropertiesScopeOptions> = {}) =>
    createPropertiesScope(client, 'project.task', 'task_properties', { parentId: 7, ...options });
  return {
    client,
    call,
    read,
    write,
    scope,
    row,
    raw,
    current,
    get defs() {
      return defs;
    },
    set defs(value) {
      defs = value;
    },
  };
}
function errorCode(code: string) {
  return expect.objectContaining({ name: 'PropertiesBindingError', code });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('parent-scoped properties', () => {
  it('creates with scoped parent/context and encoded aliases without a child read or patch', async () => {
    const f = fixture();
    const binding = (await f.scope({ context: { lang: 'en_US' } })).bind(allDeclarations);
    f.call.mockClear();
    f.read.mockClear();
    expect(
      await binding.create(
        { name: 'New task', project_id: 7, tag_ids: [[6, 0, [3]]] },
        {
          priority: 'low',
          estimate: 0,
          count: 0,
          done: false,
          text: '',
          date: '2026-10-30',
          time: '2026-10-30 12:00:00',
          owner: 12,
          people: [12, 13],
          tags: ['red'],
        },
      ),
    ).toBe(41);
    expect(f.call).toHaveBeenCalledExactlyOnceWith(
      'project.task',
      'create',
      [
        {
          name: 'New task',
          project_id: 7,
          tag_ids: [[6, 0, [3]]],
          task_properties: {
            p: 'lo',
            n: 0,
            i: 0,
            b: false,
            s: '',
            d: '2026-10-30',
            dt: '2026-10-30 12:00:00',
            one: 12,
            many: [12, 13],
            t: ['red'],
          },
        },
      ],
      { context: { lang: 'en_US' } },
    );
    expect(f.read).toHaveBeenCalledExactlyOnceWith(
      'project.project',
      [7],
      ['task_properties_definition'],
      { lang: 'en_US' },
    );
    expect(f.write).not.toHaveBeenCalled();
  });

  it('encodes creation clears and leaves omitted properties to server defaults', async () => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    f.call.mockClear();
    await binding.create(
      { name: 'Cleared' },
      {
        priority: null,
        estimate: null,
        count: null,
        done: null,
        text: null,
        date: null,
        time: null,
        owner: null,
        people: null,
        tags: null,
      },
    );
    expect(f.call.mock.calls[0]?.[2]).toEqual([
      {
        name: 'Cleared',
        project_id: 7,
        task_properties: {
          p: false,
          n: false,
          i: false,
          b: false,
          s: false,
          d: false,
          dt: false,
          one: false,
          many: [],
          t: [],
        },
      },
    ]);
    await binding.create({ name: 'Default' });
    expect(f.call.mock.calls[1]?.[2]).toEqual([
      { name: 'Default', project_id: 7, task_properties: {} },
    ]);
  });

  it.each([
    [null, {}],
    [[], {}],
    [{ task_properties: {} }, {}],
    [{ project_id: 8 }, {}],
    [{ project_id: false }, {}],
    [{ project_id: [7, 'Project'] }, {}],
    [{}, null],
    [{}, []],
    [{}, { unknown: 1 }],
    [{}, { priority: 'urgent' }],
    [{}, { tags: ['blue'] }],
    [{}, { estimate: undefined }],
    [{}, { owner: [12, 'Name'] }],
    [{}, { people: [[12, 'Name']] }],
    [{}, { count: 1.5 }],
  ])('rejects invalid creation input before any RPC (%j, %j)', async (values, properties) => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    f.call.mockClear();
    f.read.mockClear();
    await expect(
      binding.create(values as Record<string, unknown>, properties as never),
    ).rejects.toBeInstanceOf(PropertiesBindingError);
    expect(f.call).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
  });

  it.each([
    'id',
    'type',
    'comodel',
    'option',
  ] as const)('rejects %s drift before creating', async (drift) => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    if (drift === 'id') required(f.defs[0]).name = 'replacement';
    if (drift === 'type') required(f.defs[0]).type = 'char';
    if (drift === 'comodel') required(f.defs[7]).comodel = 'res.users';
    if (drift === 'option')
      required(f.defs[0]).selection = [
        ['replacement', 'High'],
        ['lo', 'Low'],
      ];
    f.call.mockClear();
    await expect(binding.create({ name: 'Blocked' }, { estimate: 0 })).rejects.toEqual(
      errorCode('stale-binding'),
    );
    expect(f.call).not.toHaveBeenCalled();
  });

  it('detaches creation input before awaiting the fresh parent definitions', async () => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    const gate = deferred<Record<string, unknown>[]>();
    f.read.mockImplementationOnce(async () => (await gate.promise) as never);
    f.call.mockClear();
    const values = { name: 'Original', tag_ids: [[6, 0, [3]]] };
    const properties = { people: [12], tags: ['red'] as 'red'[] };
    const pending = binding.create(values, properties);
    values.name = 'Changed';
    values.tag_ids[0]?.push([4]);
    properties.people.push(13);
    properties.tags.length = 0;
    gate.resolve([{ id: 7, task_properties_definition: f.defs }]);
    await pending;
    expect(f.call.mock.calls[0]?.[2]).toEqual([
      {
        name: 'Original',
        tag_ids: [[6, 0, [3]]],
        project_id: 7,
        task_properties: { many: [12], t: ['red'] },
      },
    ]);
  });

  it.each([
    new OdooRpcError('Rejected'),
    new OdooSafetyError({
      name: 'odoo.create',
      level: 'WRITE',
      model: 'project.task',
      description: 'Create task',
    }),
    new OdooNetworkError('Lost response', new Error('Connection reset')),
    new OdooProtocolError('Malformed response'),
  ])('propagates creation failures unchanged without retries (%s)', async (error) => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    f.call.mockReset().mockRejectedValue(error);
    await expect(binding.create({ name: 'New' }, { estimate: 0 })).rejects.toBe(error);
    expect(f.call).toHaveBeenCalledTimes(1);
    expect(f.write).not.toHaveBeenCalled();
  });

  it.each([
    false,
    null,
    undefined,
    0,
    -1,
    1.5,
    '41',
    [41],
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid create response %j without retries', async (result) => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    f.call.mockReset().mockResolvedValue(result as never);
    await expect(binding.create({ name: 'New' })).rejects.toBeInstanceOf(OdooProtocolError);
    expect(f.call).toHaveBeenCalledTimes(1);
  });

  it('discovers metadata with exact context/projection, exposes detached raw snapshots and supports the accessor', async () => {
    const f = fixture();
    const context = { lang: 'en_US', allowed_company_ids: [1] };
    const pending = f.scope({ context });
    context.allowed_company_ids.push(2);
    const scope = await pending;
    expect(f.call.mock.calls).toEqual([
      [
        'project.task',
        'fields_get',
        [['task_properties']],
        {
          attributes: ['type', 'definition_record', 'definition_record_field'],
          context: { lang: 'en_US', allowed_company_ids: [1] },
        },
      ],
      [
        'project.task',
        'fields_get',
        [['project_id']],
        { attributes: ['type', 'relation'], context: { lang: 'en_US', allowed_company_ids: [1] } },
      ],
    ]);
    expect(f.read).toHaveBeenCalledExactlyOnceWith(
      'project.project',
      [7],
      ['task_properties_definition'],
      { lang: 'en_US', allowed_company_ids: [1] },
    );
    const info = scope.describe();
    required(info.definitions[0]).selection = [];
    info.parent.model = 'wrong';
    info.context.allowed_company_ids = [];
    (
      (info.metadata.properties as Record<string, unknown>).task_properties as Record<
        string,
        unknown
      >
    ).extra = false;
    expect(scope.describe().definitions[0]?.selection).toHaveLength(3);
    expect(scope.describe().parent).toEqual({
      model: 'project.project',
      field: 'task_properties_definition',
      relation: 'project_id',
    });
    expect(scope.describe().context.allowed_company_ids).toEqual([1]);
    expect(scope.describe().metadata).toHaveProperty(
      'properties.task_properties.extra.nested',
      [1],
    );
    const client = new OdooClient({
      url: 'http://unused',
      database: 'test',
      username: 'user',
      password: 'unused',
    });
    vi.spyOn(client, 'call').mockImplementation(f.call);
    vi.spyOn(client, 'read').mockImplementation(f.read);
    expect(client.properties).toBe(client.properties);
    expect(
      (await client.properties.scope('project.task', 'task_properties', { parentId: 7 })).describe()
        .parentId,
    ).toBe(7);
  });

  it('supports explicit parent metadata overrides but enforces the real relation model and membership', async () => {
    const f = fixture();
    f.call.mockImplementation(
      async (_m, _method, args) =>
        ((args?.[0] as string[])[0] === 'task_properties'
          ? { task_properties: { type: 'properties' } }
          : { project_id: { type: 'many2one', relation: 'project.project' } }) as never,
    );
    await expect(f.scope()).rejects.toEqual(errorCode('invalid-metadata'));
    const parent = {
      model: 'project.project',
      field: 'task_properties_definition',
      relation: 'project_id',
    };
    const scope = await f.scope({ parent });
    parent.model = 'mutated';
    f.read.mockResolvedValueOnce([f.row(1, 8)] as never);
    await expect(scope.bind(declaration).read([1])).rejects.toEqual(errorCode('wrong-parent'));
    await expect(f.scope({ parent: { ...parent, model: 'res.partner' } })).rejects.toEqual(
      errorCode('invalid-metadata'),
    );
    expect(f.write).not.toHaveBeenCalled();
  });

  it.each([
    { task_properties: { type: 'char' } },
    {
      task_properties: {
        type: 'properties',
        definition_record: '',
        definition_record_field: 'defs',
      },
    },
    null,
  ])('rejects invalid discovery metadata %j', async (metadata) => {
    const f = fixture();
    f.call.mockResolvedValueOnce(metadata as never);
    await expect(f.scope()).rejects.toEqual(errorCode('invalid-metadata'));
  });

  it('validates exact selectors, declaration kinds, competing aliases, comodels and required options', async () => {
    const f = fixture();
    const scope = await f.scope();
    const invalid: unknown[] = [
      { x: { label: 'Effort', id: 'n', type: 'float' } },
      { x: { label: 'Effort', type: 'float', options: {} } },
      { x: { id: 'sep', type: 'separator' } },
      { x: { id: 'one', type: 'many2one', comodel: 'wrong' } },
      { x: { id: 'p', type: 'selection' } },
      { a: { id: 'n', type: 'float' }, b: { label: 'Effort', type: 'float' } },
      { x: { id: 'p', type: 'selection', options: { a: { id: 'hi' }, b: { label: 'High' } } } },
      { x: { id: 'p', type: 'selection', options: { a: { id: 'hi', label: 'High' } } } },
    ];
    for (const input of invalid)
      expect(() => scope.bind(input as PropertiesDeclarations)).toThrow(PropertiesBindingError);
    expect(() => scope.bind({ x: { label: 'Absent', type: 'float' } })).toThrow('IDs: (none)');
    f.defs.push({ name: 'n2', string: 'Effort', type: 'float' });
    await scope.refresh();
    expect(() => scope.bind(declaration)).toThrow('IDs: n, n2');
    required(f.defs[0]).selection = [
      ['hi', 'Same'],
      ['lo', 'Same'],
    ];
    await scope.refresh();
    expect(() =>
      scope.bind({ x: { id: 'p', type: 'selection', options: { one: { label: 'Same' } } } }),
    ).toThrow('IDs: hi, lo');
  });

  it('retains bound IDs through renames/reordering/colors/additions, detaches declarations/mapping and does not rebind on refresh', async () => {
    const f = fixture();
    const scope = await f.scope();
    const declarations = structuredClone(allDeclarations);
    const binding = scope.bind(declarations);
    (declarations.priority.options.high as { label: string }).label = 'changed';
    const mapping = binding.mapping();
    mapping.priority.id = 'wrong';
    required(mapping.priority.options).high = 'wrong';
    mapping.people.comodel = 'wrong';
    required(f.defs[0]).string = 'Renamed';
    required(f.defs[0]).selection = [
      ['hi', 'New high'],
      ['lo', 'New low'],
      ['other', 'Other'],
    ];
    required(f.defs[9]).tags = [
      ['red', 'New red', 9],
      ['blue', 'New blue', 7],
    ];
    f.defs.reverse();
    f.defs.push({ name: 'new', string: 'New', type: 'char' });
    f.current.set('new', 'untouched');
    f.current.set('t', ['red']);
    // Existing bindings tolerate unrelated additions even before explicit refresh.
    expect((await binding.read([1]))[0]?.properties.priority).toBe('high');
    await scope.refresh();
    expect(binding.mapping().priority).toEqual({
      id: 'p',
      type: 'selection',
      options: { high: 'hi', low: 'lo' },
    });
    expect(binding.mapping().people.comodel).toBe('res.partner');
    expect((await binding.read([1]))[0]?.properties.priority).toBe('high');
    expect(() => scope.bind(declaration)).toThrow('matched 0');
  });

  it.each([
    'id',
    'type',
    'comodel',
    'option',
  ] as const)('rejects %s drift without writing or rebinding labels', async (drift) => {
    const f = fixture();
    const scope = await f.scope();
    const binding = scope.bind(allDeclarations);
    if (drift === 'id') required(f.defs[0]).name = 'replacement';
    if (drift === 'type') required(f.defs[0]).type = 'char';
    if (drift === 'comodel') required(f.defs[7]).comodel = 'res.users';
    if (drift === 'option')
      required(f.defs[0]).selection = [
        ['replacement', 'High'],
        ['lo', 'Low'],
      ];
    await expect(binding.patch(1, { estimate: 1 })).rejects.toEqual(errorCode('stale-binding'));
    expect(f.write).not.toHaveBeenCalled();
    expect(binding.mapping().priority.id).toBe('p');
  });

  it('normalizes tuples and falsy values, preserves dates as strings, returns requested order and detached raw data', async () => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    f.current.set('t', []);
    f.current.set('i', 0);
    f.current.set('n', 0);
    f.current.set('s', '');
    f.read.mockResolvedValueOnce([f.row(2), f.row(1)] as never);
    const result = await binding.read([1, 2]);
    expect(result.map((row) => row.id)).toEqual([1, 2]);
    expect(result[0]?.properties).toEqual({
      priority: 'high',
      estimate: 0,
      count: 0,
      done: false,
      text: '',
      date: '2026-10-29',
      time: '2026-10-29 11:23:45',
      owner: 12,
      people: [12, 13],
      tags: [],
    });
    required(required(result[0]).raw[0]).string = 'mutated';
    expect(binding.mapping().priority.id).toBe('p');
    for (const id of ['p', 'n', 'i', 's', 'd', 'dt', 'one', 'many', 't']) f.current.set(id, false);
    const unset = (await binding.read([1]))[0]?.properties;
    expect(unset).toEqual({
      priority: null,
      estimate: null,
      count: null,
      done: false,
      text: null,
      date: null,
      time: null,
      owner: null,
      people: null,
      tags: null,
    });
  });

  it.each([
    ['p', 'other'],
    ['t', ['blue']],
  ])('reports raw unmapped option diagnostics for %s', async (propertyId, value) => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    f.current.set(propertyId as string, value);
    try {
      await binding.read([21]);
      assert.fail('expected error');
    } catch (error) {
      assert(error instanceof PropertiesBindingError);
      expect(error.code).toBe('unmapped-option');
      expect(error.details).toEqual({
        recordId: 21,
        propertyId,
        optionId: propertyId === 'p' ? 'other' : 'blue',
      });
      expect(error.toJSON()).toHaveProperty('details.recordId', 21);
    }
  });

  it('merges only supplied aliases and preserves unbound relations, unmapped options and zero/false/empty payloads', async () => {
    const f = fixture();
    const binding = (await f.scope({ context: { lang: 'en_US' } })).bind(allDeclarations);
    f.current.set('p', 'other'); // Unmapped but untouched during a mutation.
    f.read.mockClear();
    expect(
      await binding.patch(1, { estimate: 0, done: false, text: '', people: [], tags: [] }),
    ).toEqual({ id: 1, status: 'acknowledged' });
    expect(f.read.mock.calls.map(([model]) => model)).toEqual(['project.project', 'project.task']);
    expect(f.write).toHaveBeenCalledExactlyOnceWith(
      'project.task',
      1,
      {
        task_properties: {
          p: 'other',
          n: 0,
          i: 2,
          b: false,
          s: '',
          d: '2026-10-29',
          dt: '2026-10-29 11:23:45',
          one: 12,
          many: [],
          t: [],
        },
      },
      { lang: 'en_US' },
    );
    f.write.mockClear();
    await binding.patch(2, {
      priority: null,
      estimate: null,
      done: null,
      text: null,
      date: null,
      time: null,
      owner: null,
      people: null,
      tags: null,
    });
    expect(f.write.mock.calls[0]?.[2]).toEqual({
      task_properties: {
        p: false,
        n: false,
        i: 2,
        b: false,
        s: false,
        d: false,
        dt: false,
        one: false,
        many: [],
        t: [],
      },
    });
    f.write.mockClear();
    await binding.patch(3, { priority: 'low', tags: ['red'] });
    expect(f.write.mock.calls[0]?.[2]).toHaveProperty(
      'task_properties',
      expect.objectContaining({ p: 'lo', t: ['red'], one: 12, many: [12, 13] }),
    );
  });

  it('preserves unbound and unmapped values while patchMany and patchEach restore request order', async () => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    f.read.mockImplementation(
      async (model, ids) =>
        (model === 'project.project'
          ? [{ id: 7, task_properties_definition: f.defs }]
          : (ids as number[])
              .map((id) => ({
                ...f.row(id),
                task_properties: f
                  .raw()
                  .map((prop) => (prop.name === 'n' ? { ...prop, value: id } : prop)),
              }))
              .reverse()) as never,
    );
    const receipts = await binding.patchEach([
      { id: 2, changes: { priority: 'low' } },
      { id: 1, changes: { estimate: 0 } },
    ]);
    expect(receipts.map((receipt) => receipt.id)).toEqual([2, 1]);
    expect(f.write.mock.calls[0]?.[2]).toHaveProperty(
      'task_properties',
      expect.objectContaining({ p: 'lo', n: 2, one: 12, many: [12, 13], t: ['blue'] }),
    );
    expect(f.write.mock.calls[1]?.[2]).toHaveProperty('task_properties.n', 0);
    f.read.mockClear();
    f.write.mockClear();
    await binding.patchMany([4, 3], { estimate: 0 });
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.write).toHaveBeenCalledTimes(2);
  });

  it('takes caller patch array snapshots before awaiting definitions', async () => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    const gate = deferred<object[]>();
    f.read.mockImplementationOnce(async () => gate.promise as never);
    const people = [25];
    const tags: 'red'[] = ['red'];
    const changes = [{ id: 1, changes: { people, tags } }];
    const pending = binding.patchEach(changes);
    people.push(99);
    tags.length = 0;
    required(changes[0]).id = 5;
    gate.resolve([{ id: 7, task_properties_definition: f.defs }]);
    await pending;
    expect(f.write.mock.calls[0]?.slice(1, 3)).toEqual([
      1,
      { task_properties: expect.objectContaining({ many: [25], t: ['red'] }) },
    ]);
  });

  it('does zero RPC for valid empty batches and rejects bad inputs before RPC', async () => {
    const f = fixture();
    const binding = (await f.scope()).bind(allDeclarations);
    f.read.mockClear();
    f.call.mockClear();
    expect(await binding.read([])).toEqual([]);
    expect(await binding.patchMany([], {})).toEqual([]);
    expect(await binding.patchEach([])).toEqual([]);
    const invalid = [
      { estimate: undefined },
      { missing: 1 },
      { estimate: NaN },
      { count: 1.5 },
      { done: 0 },
      { people: [[1, 'A']] },
      { people: [0] },
      { priority: 'unknown' },
      { tags: ['blue'] },
      { owner: -1 },
      { text: false },
      { date: new Date() },
    ];
    for (const patch of invalid)
      await expect(binding.patch(1, patch as never)).rejects.toEqual(errorCode('invalid-input'));
    for (const ids of [[1, 1], [0], [-1], [1.5], [NaN]])
      await expect(binding.patchMany(ids, {})).rejects.toEqual(errorCode('invalid-input'));
    await expect(
      binding.patchEach([
        { id: 1, changes: {} },
        { id: 1, changes: {} },
      ]),
    ).rejects.toEqual(errorCode('invalid-input'));
    expect(f.call).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
  });

  it.each([
    'missing',
    'duplicate',
    'unexpected',
    'moved',
    'embedded',
    'duplicate-property',
    'unsupported',
    'malformed',
  ] as const)('blocks the entire batch for %s data in the last row', async (problem) => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    const first = f.row(1);
    const last = f.row(2);
    let rows: unknown[] = [first, last];
    if (problem === 'missing') rows = [first];
    if (problem === 'duplicate') rows = [first, first];
    if (problem === 'unexpected') last.id = 3;
    if (problem === 'moved') last.project_id = [8, 'Other'];
    if (problem === 'embedded') required(last.task_properties[0]).type = 'char';
    if (problem === 'duplicate-property')
      last.task_properties.push(required(last.task_properties[0]));
    if (problem === 'unsupported') {
      f.defs.push({ name: 'new', string: 'New', type: 'binary' });
      last.task_properties.push({ name: 'new', string: 'New', type: 'binary', value: false });
    }
    if (problem === 'malformed') required(last.task_properties[8]).value = [[12, 'A'], 13];
    f.read
      .mockImplementationOnce(async () => [{ id: 7, task_properties_definition: f.defs }] as never)
      .mockResolvedValueOnce(rows as never);
    await expect(binding.patchMany([1, 2], { estimate: 1 })).rejects.toBeInstanceOf(
      PropertiesBindingError,
    );
    expect(f.write).not.toHaveBeenCalled();
  });

  it.each([
    ['n', 'bad'],
    ['i', 2.5],
    ['b', 0],
    ['s', []],
    ['d', new Date()],
    ['dt', 42],
    ['one', [1, false]],
    ['many', [[1, 'A'], 2]],
    ['t', [false]],
    ['p', 5],
  ])('rejects malformed raw %s even when patching a different property', async (id, value) => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    f.current.set(id as string, value);
    await expect(binding.patch(1, { estimate: 0 })).rejects.toEqual(errorCode('malformed-value'));
    expect(f.write).not.toHaveBeenCalled();
  });

  it('limits concurrency, settles every result in input order, and preserves original thrown values', async () => {
    const f = fixture();
    const binding = (await f.scope({ concurrency: 2 })).bind(declaration);
    const failures = [
      new OdooValidationError('rejected'),
      new OdooNetworkError('lost', new Error('disconnect')),
      new OdooTimeoutError('timeout', new Error('timeout')),
      new OdooProtocolError('missing result'),
      { arbitrary: true },
      new OdooRpcError('server rejection'),
      new OdooSafetyError({
        model: 'project.task',
        name: 'odoo.write',
        level: 'WRITE',
        description: 'blocked',
      }),
    ];
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    let active = 0;
    let maximum = 0;
    f.write.mockImplementation(async (_model, id) => {
      active++;
      maximum = Math.max(maximum, active);
      try {
        if (id === 1) return await first.promise;
        if (id === 2) return await second.promise;
        if (id === 10) return false;
        throw failures[(id as number) - 3];
      } finally {
        active--;
      }
    });
    const pending = binding.patchMany([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { estimate: 1 });
    await vi.waitFor(() => expect(f.write).toHaveBeenCalledTimes(2));
    second.resolve(true);
    await vi.waitFor(() => expect(f.write).toHaveBeenCalledTimes(10));
    first.resolve(true);
    const receipts = await pending;
    expect(maximum).toBe(2);
    expect(receipts.map((receipt) => receipt.status)).toEqual([
      'acknowledged',
      'acknowledged',
      'failed',
      'unknown',
      'unknown',
      'unknown',
      'unknown',
      'failed',
      'failed',
      'unknown',
    ]);
    for (let index = 0; index < failures.length; index++)
      expect(receipts[index + 2]).toHaveProperty('error', failures[index]);
    expect(receipts[9]).toHaveProperty('error', false);
  });

  it('holds each mutation refresh locally when concurrent operations change the scope snapshot', async () => {
    const f = fixture();
    const binding = (await f.scope({ context: { lang: 'es_ES' } })).bind(declaration);
    const old = structuredClone(f.defs);
    const fresh = structuredClone(f.defs);
    required(fresh[4]).type = 'integer';
    const childA = deferred<object[]>();
    const childB = deferred<object[]>();
    let parents = 0;
    f.read.mockImplementation(async (model, ids, _fields, context) => {
      expect(context).toEqual({ lang: 'es_ES' });
      if (model === 'project.project')
        return [{ id: 7, task_properties_definition: parents++ === 0 ? old : fresh }] as never;
      return (await ((ids as number[])[0] === 1 ? childA.promise : childB.promise)) as never;
    });
    const a = binding.patch(1, { estimate: 1 });
    await vi.waitFor(() =>
      expect(f.read.mock.calls.filter(([model]) => model === 'project.task')).toHaveLength(1),
    );
    const b = binding.patch(2, { estimate: 2 });
    await vi.waitFor(() =>
      expect(f.read.mock.calls.filter(([model]) => model === 'project.task')).toHaveLength(2),
    );
    const rowA = f.row(1);
    const rowB = f.row(2);
    rowB.task_properties[4] = { ...fresh[4], value: 5 };
    childB.resolve([rowB]);
    childA.resolve([rowA]);
    expect(await Promise.all([a, b])).toEqual([
      { id: 1, status: 'acknowledged' },
      { id: 2, status: 'acknowledged' },
    ]);
    expect(f.write).toHaveBeenCalledTimes(2);
  });

  it('defaults to four concurrent writes', async () => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    const gate = deferred<boolean>();
    f.write.mockImplementation(async () => gate.promise);
    const pending = binding.patchMany([1, 2, 3, 4, 5], { estimate: 0 });
    await vi.waitFor(() => expect(f.write).toHaveBeenCalledTimes(4));
    gate.resolve(true);
    expect(await pending).toHaveLength(5);
  });

  it.each([
    null,
    undefined,
    { unexpected: true },
    'unexpected',
  ])('keeps unexpected write results %j unknown', async (value) => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    f.write.mockResolvedValueOnce(value as unknown as boolean);
    expect(await binding.patch(1, { estimate: 0 })).toEqual({
      id: 1,
      status: 'unknown',
      error: value,
    });
  });

  it.each([
    new Error('unclassified'),
    undefined,
    null,
    'thrown',
  ])('preserves unclassified thrown values %j', async (error) => {
    const f = fixture();
    const binding = (await f.scope()).bind(declaration);
    f.write.mockImplementationOnce(async () => {
      throw error;
    });
    const receipt = await binding.patch(1, { estimate: 0 });
    expect(receipt.status).toBe('unknown');
    assert(receipt.status !== 'acknowledged');
    expect(receipt.error).toBe(error);
  });

  it('keeps internal mappings detached from validation error diagnostics', async () => {
    const f = fixture();
    const scope = await f.scope();
    const binding = scope.bind(declaration);
    const original = structuredClone(f.defs);
    required(f.defs[0]).selection = [['hi', 'High']];
    try {
      await binding.patch(1, { estimate: 1 });
      assert.fail('expected stale binding');
    } catch (error) {
      assert(error instanceof PropertiesBindingError);
      (error.details.mapping as { id: string }).id = 'changed';
      ((error.details.definition as Record<string, unknown>).selection as string[][]).length = 0;
    }
    expect(binding.mapping().priority.id).toBe('p');
    expect(scope.describe().definitions[0]?.selection).toEqual([['hi', 'High']]);
    f.defs = original;
    expect(await binding.patch(1, { estimate: 1 })).toEqual({ id: 1, status: 'acknowledged' });
  });

  it.each([
    'property',
    'option',
  ] as const)('rejects duplicate technical %s IDs in discovered definitions', async (kind) => {
    const f = fixture();
    if (kind === 'property') f.defs.push({ ...f.defs[0] });
    else
      required(f.defs[0]).selection = [
        ['hi', 'First'],
        ['hi', 'Second'],
      ];
    await expect(f.scope()).rejects.toEqual(errorCode('invalid-definitions'));
  });

  it('does not share parent definitions across scopes', async () => {
    const f = fixture();
    const a = await f.scope();
    const binding = a.bind(declaration);
    f.read.mockResolvedValueOnce([
      { id: 8, task_properties_definition: [{ name: 'other', string: 'Effort', type: 'float' }] },
    ] as never);
    const b = await f.scope({ parentId: 8 });
    expect(b.bind({ estimate: { label: 'Effort', type: 'float' } }).mapping().estimate.id).toBe(
      'other',
    );
    expect(binding.mapping().estimate.id).toBe('n');
    f.read.mockResolvedValueOnce([f.row(1, 8)] as never);
    await expect(binding.read([1])).rejects.toEqual(errorCode('wrong-parent'));
  });
});

// Compiled by the strict source/test gate; never contacts a server.
async function typeContract(
  scope: Awaited<ReturnType<typeof createPropertiesScope>>,
  proxy: OAuthProxyClient,
) {
  const binding = scope.bind(allDeclarations);
  const result = await binding.read([1]);
  const priority: 'high' | 'low' | null = required(result[0]).properties.priority;
  const people: number[] | null = required(result[0]).properties.people;
  const done: boolean | null = required(result[0]).properties.done;
  void [priority, people, done];
  await binding.patch(1, {
    priority: 'high',
    estimate: 0,
    tags: ['red'],
    owner: 1,
    done: false,
    date: null,
  });
  // @ts-expect-error read rows expose properties, never values
  required(result[0]).values;
  // @ts-expect-error unknown property alias
  await binding.patch(1, { missing: 1 });
  // @ts-expect-error unknown selection alias
  await binding.patchMany([1], { priority: 'other' });
  // @ts-expect-error unknown tag alias
  await binding.patchEach([{ id: 1, changes: { tags: ['blue'] } }]);
  // @ts-expect-error float is numeric
  await binding.patch(1, { estimate: '1' });
  // @ts-expect-error dates remain strings
  await binding.patch(1, { date: new Date() });
  // @ts-expect-error relations use IDs
  await binding.patch(1, { owner: [1, 'Name'] });
  // @ts-expect-error selection requires an alias map
  scope.bind({ x: { id: 'p', type: 'selection' } });
  // @ts-expect-error exact selector only
  scope.bind({ x: { id: 'n', label: 'Effort', type: 'float' } });
  // @ts-expect-error separator cannot be bound
  scope.bind({ x: { id: 'sep', type: 'separator' } });
  await createPropertiesScope(proxy, 'project.task', 'task_properties', { parentId: 7 });
}
void typeContract;

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
