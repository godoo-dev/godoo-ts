import { describe, expect, it } from 'vitest';
import { generateModelInterface, mapFieldType } from '../src/formatters.js';
import { type IntrospectionClient, Introspector, type OdooField } from '../src/portable.js';

describe('portable introspection', () => {
  it('uses only model RPC capabilities and preserves native Maps, cache and invalidation', async () => {
    const calls: Array<{ model: string; method: string }> = [];
    const models = [{ id: 1, model: 'res.partner', name: 'Contact', transient: false }];
    const fields: OdooField[] = [
      {
        id: 2,
        model: 'res.partner',
        name: 'name',
        field_description: 'Name',
        ttype: 'char',
        required: true,
        readonly: false,
      },
    ];
    const client: IntrospectionClient = {
      async call<T>(model: string, method: string): Promise<T> {
        calls.push({ model, method });
        return { name: { type: 'char', translate: true } } as T;
      },
      async searchRead<T extends object>(model: string): Promise<T[]> {
        calls.push({ model, method: 'search_read' });
        return structuredClone(model === 'ir.model' ? models : fields) as T[];
      },
    };
    const introspector = new Introspector(client);
    const metadata = await introspector.getModelMetadata('res.partner');
    expect(await introspector.getModelMetadata('res.partner')).toBe(metadata);
    expect(await introspector.getFields('res.partner')).toBe(metadata.fields);
    expect(calls).toHaveLength(2);

    const attributes = await introspector.getFieldAttributes('res.partner');
    expect(attributes).toBeInstanceOf(Map);
    expect([...attributes]).toEqual([['name', { translate: true }]]);
    expect(await introspector.getFieldAttributes('res.partner')).toBe(attributes);
    expect(calls).toHaveLength(3);

    introspector.clearModelCache('res.partner');
    expect(await introspector.getModelMetadata('res.partner')).not.toBe(metadata);
    expect(await introspector.getFieldAttributes('res.partner')).not.toBe(attributes);
    // Per-model invalidation retains the model catalogue, but reloads fields and attributes.
    expect(calls).toHaveLength(5);
    introspector.clearCache();
    await introspector.getModelMetadata('res.partner');
    expect(calls).toHaveLength(7);

    expect(generateModelInterface(metadata)).toContain('export interface ResPartner');
    expect(generateModelInterface(metadata)).toContain('name: string;');
    const firstField = metadata.fields[0];
    if (!firstField) throw new Error('Expected recorded model field');
    expect(mapFieldType(firstField)).toBe('string');
  });
});
