import { describe, expect, it, vi } from 'vitest';
import { OdooClient } from '../src/client/odoo-client.js';
import { PropertiesService } from '../src/services/properties/properties-service.js';
import {
  getPropertyValue,
  type PropertiesReadFormat,
  propertiesToWriteFormat,
} from '../src/types/properties.js';

describe('Properties Service', () => {
  it('should be accessible via client.properties', () => {
    const client = new OdooClient({
      url: 'http://test.example.com',
      database: 'test',
      username: 'test',
      password: 'test',
    });

    expect(client.properties).toBeInstanceOf(PropertiesService);
    expect(client.properties).toBe(client.properties); // Should be cached
  });

  it('should have the expected methods', () => {
    const client = new OdooClient({
      url: 'http://test.example.com',
      database: 'test',
      username: 'test',
      password: 'test',
    });

    const service = client.properties;

    expect(typeof service.updateSafely).toBe('function');
    expect(typeof service.updateSafelyBatch).toBe('function');
    expect(typeof service.getCurrentWriteFormat).toBe('function');
  });
});

// Producer-shaped RPC responses exercise the boundary between reads and dict writes.
function relationProperties(owner = 7, watchers = [7, 8]): PropertiesReadFormat {
  return [
    {
      name: 'owner',
      string: 'Owner',
      type: 'many2one',
      comodel: 'res.partner',
      value: [owner, null],
    },
    {
      name: 'watchers',
      string: 'Watchers',
      type: 'many2many',
      comodel: 'res.partner',
      value: watchers.map((id): [number, string] => [id, `Partner ${id}`]),
    },
    { name: 'score', string: 'Score', type: 'integer', value: 0 },
    { name: 'active', string: 'Active', type: 'boolean', value: false },
    { name: 'text', string: 'Text', type: 'char', value: '' },
    { name: 'tags', string: 'Tags', type: 'tags', tags: [['red', 'Red', 1]], value: [] },
    { name: 'section', string: 'Section', type: 'separator' },
  ];
}

// Invalid RPC responses cannot be expressed by the public read type.
function convertUnknown(value: unknown) {
  return propertiesToWriteFormat(value as PropertiesReadFormat);
}

describe('propertiesToWriteFormat', () => {
  it('normalizes RPC relation tuples and preserves falsy values without mutating input', () => {
    const input = relationProperties();
    const snapshot = structuredClone(input);
    for (const property of input) {
      if (Array.isArray(property.value)) {
        for (const item of property.value) if (Array.isArray(item)) Object.freeze(item);
        Object.freeze(property.value);
      }
      Object.freeze(property);
    }
    Object.freeze(input);
    const result = propertiesToWriteFormat(input);
    expect(result).toEqual({
      owner: 7,
      watchers: [7, 8],
      score: 0,
      active: false,
      text: '',
      tags: [],
    });
    expect(input).toEqual(snapshot);
    expect(result.tags).not.toBe(getPropertyValue(input, 'tags'));
  });

  it('accepts both available and unavailable relation display names', () => {
    const input: PropertiesReadFormat = [
      {
        name: 'owner',
        string: 'Owner',
        type: 'many2one',
        comodel: 'res.partner',
        value: [3, 'Partner'],
      },
      {
        name: 'watchers',
        string: 'Watchers',
        type: 'many2many',
        comodel: 'res.partner',
        value: [
          [4, null],
          [5, 'Partner'],
        ],
      },
    ];
    expect(propertiesToWriteFormat(input)).toEqual({ owner: 3, watchers: [4, 5] });
  });

  it('keeps ID-only relations and supported scalar, selection and tag values', () => {
    const input: PropertiesReadFormat = [
      { name: 'owner', string: 'Owner', type: 'many2one', comodel: 'res.partner', value: 3 },
      {
        name: 'watchers',
        string: 'Watchers',
        type: 'many2many',
        comodel: 'res.partner',
        value: [4, 5],
      },
      { name: 'integer', string: 'Integer', type: 'integer', value: 12 },
      { name: 'float', string: 'Float', type: 'float', value: 0 },
      { name: 'fraction', string: 'Fraction', type: 'float', value: 1.25 },
      { name: 'true', string: 'True', type: 'boolean', value: true },
      { name: 'date', string: 'Date', type: 'date', value: '2026-10-29' },
      { name: 'datetime', string: 'Datetime', type: 'datetime', value: '2026-10-29 12:00:00' },
      {
        name: 'selection',
        string: 'Selection',
        type: 'selection',
        selection: [['a', 'A']],
        value: 'a',
      },
      { name: 'tags', string: 'Tags', type: 'tags', tags: [['a', 'A', 2]], value: ['a'] },
    ];
    expect(propertiesToWriteFormat(input)).toEqual({
      owner: 3,
      watchers: [4, 5],
      integer: 12,
      float: 0,
      fraction: 1.25,
      true: true,
      date: '2026-10-29',
      datetime: '2026-10-29 12:00:00',
      selection: 'a',
      tags: ['a'],
    });
  });

  it.each([
    'char',
    'integer',
    'float',
    'boolean',
    'date',
    'datetime',
    'selection',
    'tags',
    'many2one',
    'many2many',
  ])('preserves false and null unset values for %s', (type) => {
    for (const value of [false, null]) {
      expect(convertUnknown([{ name: 'unset', type, comodel: false, value }])).toEqual({
        unset: value,
      });
    }
  });

  it('preserves empty relation arrays and handles separators with or without values', () => {
    expect(
      convertUnknown([
        { name: 'empty', type: 'many2many', comodel: false, value: [] },
        { name: 'section', type: 'separator' },
        { name: 'another', type: 'separator', value: false },
      ]),
    ).toEqual({ empty: [] });
    expect(propertiesToWriteFormat([])).toEqual({});
  });

  it('creates an own __proto__ property without changing the object prototype', () => {
    const result = convertUnknown([{ name: '__proto__', type: 'char', value: 'preserved' }]);
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(result.__proto__).toBe('preserved');
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it.each([null, false, {}, '', 0, undefined])('rejects malformed containers: %s', (value) => {
    expect(() => convertUnknown(value)).toThrow(/must be an array/);
  });

  it.each([
    [null, /expected an object/],
    [[], /expected an object/],
    [{ type: 'char', value: '' }, /name/],
    [{ name: null, type: 'char', value: '' }, /name/],
    [{ name: '', type: 'char', value: '' }, /name/],
    [{ name: 'broken', value: '' }, /type/],
    [{ name: 'broken', type: null, value: '' }, /type/],
    [{ name: 'broken', type: 'char' }, /missing value/],
    [{ name: 'broken', type: 'char', value: undefined }, /malformed char/],
    [{ name: 'broken', type: 'json', value: null }, /unsupported.*json/],
    [{ name: 'broken', type: 'integer', value: 1.5 }, /malformed integer/],
    [{ name: 'broken', type: 'float', value: Number.NaN }, /malformed float/],
    [{ name: 'broken', type: 'boolean', value: 0 }, /malformed boolean/],
    [{ name: 'broken', type: 'tags', value: [['a', 'A', 1]] }, /malformed tags/],
    [{ name: 'broken', type: 'selection', value: ['a', 'A'] }, /malformed selection/],
  ])('rejects malformed or unsupported entries %#', (entry, message) => {
    expect(() => convertUnknown([entry])).toThrow(message as RegExp);
  });

  it.each(
    [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      [0, 'Name'],
      [-1, 'Name'],
      [1],
      [1, 'Name', 'extra'],
      ['1', 'Name'],
      [1, false],
      [1, {}],
      {},
      '1',
      true,
    ].map((value) => ({ value })),
  )('rejects malformed many2one IDs or tuples %#', ({ value }) => {
    expect(() => convertUnknown([{ name: 'owner', type: 'many2one', value }])).toThrow(
      /owner.*positive integer ID/,
    );
  });

  it.each(
    [
      [0],
      [-1],
      [1.5],
      [[1, false]],
      [[1]],
      [[1, 'A', 'extra']],
      [[1, 'A'], 2],
      ['1'],
      {},
      true,
    ].map((value) => ({ value })),
  )('rejects malformed many2many IDs or tuples %#', ({ value }) => {
    expect(() => convertUnknown([{ name: 'watchers', type: 'many2many', value }])).toThrow(
      /watchers.*positive integer IDs/,
    );
  });
});

describe('getPropertyValue', () => {
  it('extracts raw tuples without normalization and distinguishes absent values', () => {
    const input = relationProperties();
    expect(getPropertyValue(input, 'owner')).toBe(input[0]?.value);
    expect(getPropertyValue(input, 'owner')).toEqual([7, null]);
    expect(getPropertyValue(input, 'watchers')).toEqual([
      [7, 'Partner 7'],
      [8, 'Partner 8'],
    ]);
    expect(getPropertyValue(input, 'active')).toBe(false);
    expect(getPropertyValue(input, 'score')).toBe(0);
    expect(getPropertyValue(input, 'section')).toBeUndefined();
    expect(getPropertyValue(input, 'absent')).toBeUndefined();
  });
});

function serviceFixture(records: Record<string, unknown>[]) {
  const client = new OdooClient({
    url: 'http://test.example.com',
    database: 'test',
    username: 'test',
    password: 'test',
  });
  const read = vi.spyOn(client, 'read').mockResolvedValue(records);
  const write = vi.spyOn(client, 'write').mockResolvedValue(true);
  return { service: client.properties, read, write };
}

describe('Properties Service payloads', () => {
  it('writes normalized single-record values and preserves other supported values', async () => {
    const { service, write } = serviceFixture([{ id: 1, task_properties: relationProperties() }]);
    await service.updateSafely('project.task', 1, 'task_properties', { text: 'changed' });
    expect(write).toHaveBeenCalledExactlyOnceWith('project.task', 1, {
      task_properties: {
        owner: 7,
        watchers: [7, 8],
        score: 0,
        active: false,
        text: 'changed',
        tags: [],
      },
    });
  });

  it('normalizes getCurrentWriteFormat and supports legitimate empty arrays', async () => {
    const { service, read, write } = serviceFixture([
      { id: 1, task_properties: relationProperties() },
    ]);
    expect(await service.getCurrentWriteFormat('project.task', 1, 'task_properties')).toEqual({
      owner: 7,
      watchers: [7, 8],
      score: 0,
      active: false,
      text: '',
      tags: [],
    });
    read.mockResolvedValue([{ id: 1, task_properties: [] }]);
    expect(await service.getCurrentWriteFormat('project.task', 1, 'task_properties')).toEqual({});
    await service.updateSafely('project.task', 1, 'task_properties', { score: 0 });
    expect(write).toHaveBeenCalledExactlyOnceWith('project.task', 1, {
      task_properties: { score: 0 },
    });
  });

  it('preserves independent relation values for every record in a nonempty batch', async () => {
    const { service, write } = serviceFixture([
      { id: 1, task_properties: relationProperties() },
      { id: 2, task_properties: relationProperties(9, [10, 11]) },
    ]);
    await service.updateSafelyBatch('project.task', [1, 2], 'task_properties', { score: 5 });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, 'project.task', 1, {
      task_properties: { owner: 7, watchers: [7, 8], score: 5, active: false, text: '', tags: [] },
    });
    expect(write).toHaveBeenNthCalledWith(2, 'project.task', 2, {
      task_properties: {
        owner: 9,
        watchers: [10, 11],
        score: 5,
        active: false,
        text: '',
        tags: [],
      },
    });
  });

  it.each(
    [null, false, {}, 'invalid', [{ name: 'owner', type: 'many2one', value: [1, false] }]].map(
      (value) => ({ value }),
    ),
  )('rejects malformed single reads without writing %#', async ({ value: task_properties }) => {
    const { service, write } = serviceFixture([{ id: 1, task_properties }]);
    await expect(
      service.updateSafely('project.task', 1, 'task_properties', { score: 5 }),
    ).rejects.toThrow();
    await expect(
      service.getCurrentWriteFormat('project.task', 1, 'task_properties'),
    ).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    { id: 2, task_properties: [{ name: 'owner', type: 'many2one', value: [0, 'Invalid'] }] },
    { id: 2, task_properties: {} },
    { id: 2 },
    { id: '2', task_properties: [] },
    { task_properties: [] },
  ])('validates the entire batch before any writes %#', async (invalidRecord) => {
    const { service, write } = serviceFixture([
      { id: 1, task_properties: relationProperties() },
      invalidRecord,
    ]);
    await expect(
      service.updateSafelyBatch('project.task', [1, 2], 'task_properties', { score: 5 }),
    ).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });

  it('supports an empty properties array per batch record and explicit clears', async () => {
    const { service, write } = serviceFixture([{ id: 1, task_properties: [] }]);
    await service.updateSafelyBatch('project.task', [1], 'task_properties', {
      owner: false,
      watchers: [],
      text: null,
    });
    expect(write).toHaveBeenCalledExactlyOnceWith('project.task', 1, {
      task_properties: { owner: false, watchers: [], text: null },
    });
  });

  it('handles an empty batch without RPC calls', async () => {
    const { service, read, write } = serviceFixture([]);
    await service.updateSafelyBatch('project.task', [], 'task_properties', {});
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
