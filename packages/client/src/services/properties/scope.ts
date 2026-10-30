import {
  OdooNetworkError,
  OdooProtocolError,
  OdooRpcError,
  OdooSafetyError,
} from '../../types/errors';
import {
  type PropertiesReadFormat,
  type PropertiesWriteFormat,
  type PropertyValueType,
  propertiesToWriteFormat,
} from '../../types/properties';
import type {
  BoundProperties,
  BoundPropertiesRecord,
  BoundPropertyKind,
  PropertiesBinding,
  PropertiesChange,
  PropertiesClient,
  PropertiesDeclarations,
  PropertiesDescription,
  PropertiesMapping,
  PropertiesParent,
  PropertiesPatch,
  PropertiesScope,
  PropertiesScopeOptions,
  PropertiesWriteReceipt,
  ResolvedProperty,
} from './binding-types';
import {
  compatible,
  copy,
  type Definition,
  definitions,
  fail,
  nonempty,
  object,
  PropertiesBindingError,
  positiveId,
  resolve,
  validateIds,
  validateSelector,
} from './binding-validation';

const kinds: readonly string[] = [
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
];

interface Snapshot {
  description: PropertiesDescription;
  definitions: Definition[];
}

/** Discover and bind one parent's properties using a structural CRUD client. */
export async function createPropertiesScope(
  client: PropertiesClient,
  model: string,
  field: string,
  options: PropertiesScopeOptions,
): Promise<PropertiesScope> {
  if (!nonempty(model) || !nonempty(field) || !object(options) || !positiveId(options.parentId)) {
    fail('invalid-input', 'Scope requires model, field and a positive parentId');
  }
  const settings = copy(options);
  const concurrency = settings.concurrency ?? 4;
  if (!positiveId(concurrency))
    fail('invalid-input', 'concurrency must be a positive safe integer');
  if (settings.context !== undefined && !object(settings.context))
    fail('invalid-input', 'context must be an object');
  const context = settings.context ?? {};
  const metadata = copy(
    await client.call<unknown>(model, 'fields_get', [[field]], {
      attributes: ['type', 'definition_record', 'definition_record_field'],
      context: copy(context),
    }),
  );
  if (!object(metadata) || !object(metadata[field]) || metadata[field].type !== 'properties') {
    fail('invalid-metadata', `${model}.${field} must be a properties field`, { metadata });
  }
  const fieldMetadata = metadata[field];
  let parent: PropertiesParent;
  if (settings.parent !== undefined) {
    if (
      !object(settings.parent) ||
      !['model', 'field', 'relation'].every((key) =>
        nonempty(settings.parent?.[key as keyof PropertiesParent]),
      )
    ) {
      fail('invalid-input', 'parent requires nonempty model, field and relation');
    }
    parent = copy(settings.parent);
  } else {
    if (
      !nonempty(fieldMetadata.definition_record) ||
      !nonempty(fieldMetadata.definition_record_field)
    ) {
      fail(
        'invalid-metadata',
        'Properties metadata is missing definition_record or definition_record_field',
        { metadata },
      );
    }
    parent = {
      model: '',
      relation: fieldMetadata.definition_record,
      field: fieldMetadata.definition_record_field,
    };
  }
  const relationMetadata = copy(
    await client.call<unknown>(model, 'fields_get', [[parent.relation]], {
      attributes: ['type', 'relation'],
      context: copy(context),
    }),
  );
  if (!object(relationMetadata) || !object(relationMetadata[parent.relation])) {
    fail('invalid-metadata', 'Missing parent relation metadata', { relationMetadata });
  }
  const relation = relationMetadata[parent.relation];
  if (
    !object(relation) ||
    relation.type !== 'many2one' ||
    !nonempty(relation.relation) ||
    (parent.model && parent.model !== relation.relation)
  ) {
    fail('invalid-metadata', 'Parent relation must be a many2one to the parent model', {
      relationMetadata,
      parent,
    });
  }
  parent.model = relation.relation;
  const base = {
    model,
    field,
    parentId: settings.parentId,
    parent,
    context,
    metadata: { properties: copy(metadata), relation: copy(relationMetadata) },
  };

  async function load(): Promise<Snapshot> {
    const rows = await client.read(
      parent.model,
      [settings.parentId],
      [parent.field],
      copy(context),
    );
    const row = orderedRows(rows, [settings.parentId])[0];
    const parsed = definitions(row?.[parent.field]);
    return {
      description: copy({ ...base, definitions: parsed.map((def) => def.raw) }),
      definitions: parsed,
    };
  }
  let snapshot = await load();
  async function refreshSnapshot(): Promise<Snapshot> {
    const fresh = await load();
    snapshot = fresh;
    return fresh;
  }

  return {
    describe: () => copy(snapshot.description),
    refresh: async () => copy((await refreshSnapshot()).description),
    bind<const D extends PropertiesDeclarations>(declarations: D): PropertiesBinding<D> {
      const mapping = bindDeclarations(copy(declarations), snapshot.definitions);
      const mappings = Object.values(mapping) as ResolvedProperty[];
      function checkSnapshot(current: Snapshot): void {
        for (const mapped of mappings)
          compatible(
            mapped,
            current.definitions.find((def) => def.id === mapped.id),
          );
      }
      async function readRows(
        ids: number[],
        current: Snapshot,
        mutation = false,
      ): Promise<
        Array<{ id: number; raw: PropertiesReadFormat; normalized: PropertiesWriteFormat }>
      > {
        const rows = orderedRows(
          await client.read(model, ids, [field, parent.relation], copy(context)),
          ids,
        );
        return rows.map((row) => {
          const recordId = row.id as number;
          if (relationId(row[parent.relation]) !== settings.parentId) {
            fail(
              'wrong-parent',
              `Record ${recordId} does not belong to parent ${settings.parentId}`,
              { recordId, parentId: settings.parentId, raw: row[parent.relation] },
            );
          }
          const raw = copy(row[field]);
          const embedded = definitions(raw);
          for (const definition of embedded) {
            const expected = current.definitions.find((def) => def.id === definition.id);
            // A read can observe unrelated additions since the last explicit refresh.
            // Mutations require the raw payload to agree with their fresh parent read.
            if (!mutation && !expected && !mappings.some((mapped) => mapped.id === definition.id))
              continue;
            if (
              !expected ||
              expected.type !== definition.type ||
              expected.comodel !== definition.comodel
            ) {
              fail(
                'stale-binding',
                `Record ${recordId} has incompatible embedded definition ${definition.id}`,
                { recordId, propertyId: definition.id },
              );
            }
          }
          for (const mapped of mappings)
            compatible(
              mapped,
              embedded.find((def) => def.id === mapped.id),
              { recordId },
            );
          let normalized: PropertiesWriteFormat;
          try {
            normalized = propertiesToWriteFormat(raw as PropertiesReadFormat);
          } catch (cause) {
            fail('malformed-value', `Record ${recordId} has malformed properties`, {
              recordId,
              cause,
            });
          }
          return { id: recordId, raw: raw as PropertiesReadFormat, normalized };
        });
      }
      function validatePatch(changes: unknown): PropertiesWriteFormat {
        if (!object(changes)) fail('invalid-input', 'Patch must be an object');
        const encoded: Array<[string, PropertyValueType]> = [];
        for (const [alias, value] of Object.entries(changes)) {
          if (!Object.hasOwn(mapping, alias))
            fail('invalid-input', `Unknown property alias ${alias}`, { alias });
          const mapped = mapping[alias] as ResolvedProperty;
          encoded.push([mapped.id, encode(mapped, value, alias)]);
        }
        return Object.fromEntries(encoded);
      }
      async function patchEach(
        changes: readonly PropertiesChange<D>[],
      ): Promise<PropertiesWriteReceipt[]> {
        if (!Array.isArray(changes)) fail('invalid-input', 'Changes must be an array');
        // Snapshot caller arrays before the first await, then preflight the entire input.
        const inputs = Array.from(changes, (change) => {
          if (!object(change) || !positiveId(change.id))
            fail('invalid-input', 'Each change requires a positive id and changes');
          return { id: change.id, encoded: validatePatch(change.changes) };
        });
        const ids = inputs.map((input) => input.id);
        validateIds(ids);
        if (ids.length === 0) return [];
        const current = await refreshSnapshot();
        checkSnapshot(current);
        const records = await readRows(ids, current, true);
        // Every raw value, including unbound properties, must be safe before any write.
        const payloads = records.map((record, index) => ({
          id: record.id,
          payload: copy({ [field]: { ...record.normalized, ...inputs[index]?.encoded } }),
        }));
        const receipts: PropertiesWriteReceipt[] = new Array(payloads.length);
        let next = 0;
        async function worker(): Promise<void> {
          while (next < payloads.length) {
            const index = next++;
            const item = payloads[index];
            if (!item) return;
            try {
              const result = await client.write(model, item.id, item.payload, copy(context));
              receipts[index] =
                result === true
                  ? { id: item.id, status: 'acknowledged' }
                  : { id: item.id, status: 'unknown', error: result };
            } catch (error) {
              // Network subclasses RPC; classify uncertainty first. Preserve the thrown value.
              const failed =
                !(error instanceof OdooNetworkError || error instanceof OdooProtocolError) &&
                (error instanceof OdooRpcError || error instanceof OdooSafetyError);
              receipts[index] = { id: item.id, status: failed ? 'failed' : 'unknown', error };
            }
          }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, payloads.length) }, worker));
        return receipts;
      }
      return {
        mapping: () => copy(mapping),
        async read(requested: readonly number[]): Promise<BoundPropertiesRecord<D>[]> {
          validateIds(requested);
          const ids = [...requested];
          if (ids.length === 0) return [];
          const current = snapshot;
          checkSnapshot(current);
          const records = await readRows(ids, current);
          return records.map((record) => ({
            id: record.id,
            raw: copy(record.raw),
            properties: Object.fromEntries(
              Object.entries(mapping).map(([alias, mapped]) => [
                alias,
                decode(mapped, record.normalized[mapped.id], record.id),
              ]),
            ) as BoundProperties<D>,
          }));
        },
        async patch(id: number, changes: PropertiesPatch<D>): Promise<PropertiesWriteReceipt> {
          const [receipt] = await patchEach([{ id, changes }]);
          return receipt as PropertiesWriteReceipt;
        },
        async patchMany(
          ids: readonly number[],
          changes: PropertiesPatch<D>,
        ): Promise<PropertiesWriteReceipt[]> {
          validateIds(ids);
          validatePatch(changes);
          return patchEach(ids.map((id) => ({ id, changes })));
        },
        patchEach,
      };
    },
  };
}

function orderedRows(value: unknown, ids: number[]): Record<string, unknown>[] {
  if (!Array.isArray(value)) fail('records', 'Read response must be an array');
  const rows = new Map<number, Record<string, unknown>>();
  for (const row of value) {
    if (!object(row) || !positiveId(row.id) || !ids.includes(row.id) || rows.has(row.id)) {
      fail('records', 'Read returned a duplicate, unexpected or malformed record', { row, ids });
    }
    rows.set(row.id, row);
  }
  if (rows.size !== ids.length)
    fail('records', 'Read did not return every requested record', {
      ids,
      returnedIds: [...rows.keys()],
    });
  return ids.map((id) => rows.get(id) as Record<string, unknown>);
}
function relationId(value: unknown): number | undefined {
  if (positiveId(value)) return value;
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    positiveId(value[0]) &&
    (typeof value[1] === 'string' || value[1] === null)
  )
    return value[0];
  return undefined;
}
function bindDeclarations<D extends PropertiesDeclarations>(
  input: D,
  available: Definition[],
): PropertiesMapping<D> {
  if (!object(input)) fail('invalid-input', 'Declarations must be an object');
  const seen = new Set<string>();
  const entries = Object.entries(input).map(([alias, declaration]) => {
    if (!object(declaration) || !kinds.includes(declaration.type))
      fail('invalid-input', `Invalid declaration for ${alias}`);
    const relational = declaration.type === 'many2one' || declaration.type === 'many2many';
    const choices = declaration.type === 'selection' || declaration.type === 'tags';
    validateSelector(declaration, [
      'type',
      ...(relational ? ['comodel'] : []),
      ...(choices ? ['options'] : []),
    ]);
    if (relational && Object.hasOwn(declaration, 'comodel') && !nonempty(declaration.comodel))
      fail('invalid-input', `Invalid comodel for ${alias}`);
    const resolved = resolve(declaration, available, `Property ${alias}`);
    if (
      resolved.type !== declaration.type ||
      (relational &&
        (!resolved.comodel ||
          ('comodel' in declaration && declaration.comodel !== resolved.comodel)))
    ) {
      fail('invalid-input', `Property ${resolved.id} has incompatible type or comodel`, {
        alias,
        propertyId: resolved.id,
        definition: resolved.raw,
      });
    }
    if (seen.has(resolved.id))
      fail('invalid-input', `Competing aliases for property ${resolved.id}`, {
        propertyId: resolved.id,
      });
    seen.add(resolved.id);
    const mapping: ResolvedProperty = {
      id: resolved.id,
      type: resolved.type as BoundPropertyKind,
      ...(resolved.comodel ? { comodel: resolved.comodel } : {}),
    };
    if (choices) {
      if (!('options' in declaration) || !object(declaration.options))
        fail('invalid-input', `Option aliases required for ${alias}`);
      const seenOptions = new Set<string>();
      mapping.options = Object.fromEntries(
        Object.entries(declaration.options).map(([optionAlias, selector]) => {
          validateSelector(selector);
          const option = resolve(
            selector,
            resolved.options,
            `Property ${resolved.id}, option ${optionAlias}`,
          );
          if (seenOptions.has(option.id))
            fail('invalid-input', `Competing aliases for option ${option.id}`, {
              propertyId: resolved.id,
              optionId: option.id,
            });
          seenOptions.add(option.id);
          return [optionAlias, option.id];
        }),
      );
    }
    return [alias, mapping];
  });
  return Object.fromEntries(entries) as PropertiesMapping<D>;
}
function encode(mapping: ResolvedProperty, value: unknown, alias: string): PropertyValueType {
  const array = mapping.type === 'tags' || mapping.type === 'many2many';
  if (value === null) return array ? [] : false;
  switch (mapping.type) {
    case 'char':
    case 'date':
    case 'datetime':
      if (typeof value === 'string') return value;
      break;
    case 'integer':
    case 'float':
      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (mapping.type === 'float' || Number.isInteger(value))
      )
        return value;
      break;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      break;
    case 'many2one':
      if (positiveId(value)) return value;
      break;
    case 'many2many':
      if (Array.isArray(value) && Array.from(value).every(positiveId)) return [...value];
      break;
    case 'selection':
      if (typeof value === 'string' && Object.hasOwn(mapping.options ?? {}, value))
        return mapping.options?.[value] as string;
      break;
    case 'tags':
      if (
        Array.isArray(value) &&
        Array.from(value).every(
          (item) => typeof item === 'string' && Object.hasOwn(mapping.options ?? {}, item),
        )
      ) {
        return value.map((item: string) => mapping.options?.[item] as string);
      }
      break;
  }
  return fail('invalid-input', `Invalid value for property alias ${alias} (${mapping.type})`, {
    alias,
    propertyId: mapping.id,
    value,
  });
}
function decode(
  mapping: ResolvedProperty,
  value: PropertyValueType | undefined,
  recordId: number,
): unknown {
  if (value === null || (value === false && mapping.type !== 'boolean')) return null;
  if (mapping.type !== 'selection' && mapping.type !== 'tags') return copy(value);
  function optionAlias(raw: unknown): string {
    const alias = Object.entries(mapping.options ?? {}).find(([, id]) => id === raw)?.[0];
    if (alias === undefined)
      throw new PropertiesBindingError(
        'unmapped-option',
        `Record ${recordId}, property ${mapping.id} has unmapped option ${String(raw)}`,
        { recordId, propertyId: mapping.id, optionId: raw },
      );
    return alias;
  }
  return mapping.type === 'tags' ? (value as string[]).map(optionAlias) : optionAlias(value);
}
