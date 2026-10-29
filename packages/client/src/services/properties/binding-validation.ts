import { type ErrorJSON, OdooError } from '../../types/errors';
import type { PropertySelector, ResolvedProperty } from './binding-types';

export type PropertiesErrorCode =
  | 'invalid-input'
  | 'invalid-metadata'
  | 'invalid-definitions'
  | 'selector'
  | 'stale-binding'
  | 'records'
  | 'wrong-parent'
  | 'malformed-value'
  | 'unmapped-option';

/** A local validation failure. No writes start when batch preflight throws. */
export class PropertiesBindingError extends OdooError {
  constructor(
    public readonly code: PropertiesErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PropertiesBindingError';
    Object.setPrototypeOf(this, PropertiesBindingError.prototype);
  }

  override toJSON(): ErrorJSON {
    return {
      error: 'PROPERTIES_BINDING_ERROR',
      message: this.message,
      details: { code: this.code, ...this.details },
    };
  }
}

export function fail(
  code: PropertiesErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new PropertiesBindingError(code, message, details);
}
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
export function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export function validateIds(ids: readonly number[]): void {
  if (
    !Array.isArray(ids) ||
    !Array.from(ids).every(positiveId) ||
    new Set(ids).size !== ids.length
  ) {
    fail('invalid-input', 'Record IDs must be unique positive safe integers');
  }
}
export function copy<T>(value: T): T {
  return structuredClone(value);
}
export interface Definition {
  id: string;
  label: string;
  type: string;
  comodel?: string;
  options: Array<{ id: string; label: string }>;
  raw: Record<string, unknown>;
}
export function definitions(value: unknown): Definition[] {
  if (!Array.isArray(value)) fail('invalid-definitions', 'Definitions must be an array');
  const seen = new Set<string>();
  return Array.from(value, (raw: unknown) => {
    if (
      !object(raw) ||
      !nonempty(raw.name) ||
      typeof raw.string !== 'string' ||
      !nonempty(raw.type)
    ) {
      fail('invalid-definitions', 'Malformed property definition', { raw });
    }
    if (seen.has(raw.name))
      fail('invalid-definitions', `Duplicate property ID ${raw.name}`, { propertyId: raw.name });
    seen.add(raw.name);
    const options: Definition['options'] = [];
    if (raw.type === 'selection' || raw.type === 'tags') {
      const list = raw[raw.type] ?? [];
      if (!Array.isArray(list)) fail('invalid-definitions', `Malformed options for ${raw.name}`);
      const optionIds = new Set<string>();
      for (const option of list) {
        if (
          !Array.isArray(option) ||
          option.length !== (raw.type === 'tags' ? 3 : 2) ||
          !nonempty(option[0]) ||
          typeof option[1] !== 'string' ||
          (raw.type === 'tags' && (typeof option[2] !== 'number' || !Number.isInteger(option[2])))
        ) {
          fail('invalid-definitions', `Malformed option for ${raw.name}`, {
            propertyId: raw.name,
            raw: option,
          });
        }
        if (optionIds.has(option[0]))
          fail('invalid-definitions', `Duplicate option ID ${option[0]}`, {
            propertyId: raw.name,
            optionId: option[0],
          });
        optionIds.add(option[0]);
        options.push({ id: option[0], label: option[1] });
      }
    }
    return {
      id: raw.name,
      label: raw.string,
      type: raw.type,
      ...(nonempty(raw.comodel) ? { comodel: raw.comodel } : {}),
      options,
      raw: copy(raw),
    };
  });
}

export function validateSelector(
  value: unknown,
  additional: string[] = [],
): asserts value is PropertySelector {
  if (!object(value)) fail('invalid-input', 'Selector must be an object');
  const keys = Object.keys(value).filter((key) => !additional.includes(key));
  if (keys.length !== 1 || (keys[0] !== 'id' && keys[0] !== 'label') || !nonempty(value[keys[0]])) {
    fail('invalid-input', 'Selector must contain exactly one nonempty {label} or {id}', {
      selector: value,
    });
  }
}
export function resolve<T extends { id: string; label: string }>(
  selector: PropertySelector,
  items: T[],
  subject: string,
): T {
  const matches = items.filter((item) =>
    'id' in selector ? item.id === selector.id : item.label === selector.label,
  );
  if (matches.length !== 1)
    fail(
      'selector',
      `${subject}: selector ${JSON.stringify(selector)} matched ${matches.length}; IDs: ${matches.map((item) => item.id).join(', ') || '(none)'}`,
      {
        selector,
        ids: matches.map((item) => item.id),
        availableIds: items.map((item) => item.id),
      },
    );
  return matches[0] as T;
}
export function compatible(
  mapping: ResolvedProperty,
  definition: Definition | undefined,
  details: Record<string, unknown> = {},
): void {
  if (
    !definition ||
    definition.type !== mapping.type ||
    definition.comodel !== mapping.comodel ||
    Object.values(mapping.options ?? {}).some(
      (id) => !definition.options.some((option) => option.id === id),
    )
  ) {
    fail('stale-binding', `Property ${mapping.id} or its mapped options changed incompatibly`, {
      ...details,
      propertyId: mapping.id,
      mapping: copy(mapping),
      definition: copy(definition?.raw),
    });
  }
}
