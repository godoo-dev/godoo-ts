/**
 * Type definitions for Odoo Properties fields
 *
 * Properties in Odoo are user-definable fields that can be created dynamically
 * via the web UI. They appear in models like crm.lead (lead_properties) and
 * project.task (task_properties).
 *
 * Allowed property types (from odoo/fields.py:Properties.ALLOWED_TYPES):
 * - boolean, integer, float, char, date, datetime (standard types)
 * - many2one, many2many, selection, tags (relational-like types)
 * - separator (UI type)
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3188 - Properties class
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3419 - PropertiesDefinition class
 * @see https://github.com/odoo/odoo/blob/17.0/addons/crm/models/crm_lead.py - lead_properties usage
 */

/**
 * Base property definition interface
 *
 * Defines the structure of a property in PropertiesDefinition fields.
 * Each property has a name (technical identifier), type, and human-readable string.
 */
export interface PropertyDefinitionBase {
  /** Technical name of the property (e.g., 'custom_field_1') */
  name: string;
  /** Human-readable label (e.g., 'Custom Field 1') */
  string: string;
}

/**
 * Character/Text property definition
 */
export interface CharPropertyDefinition extends PropertyDefinitionBase {
  type: 'char';
}

/**
 * Separator property definition (UI element, no value)
 *
 * Used to organize properties visually in the UI.
 * Handled in: odoo/fields.py:Properties.ALLOWED_TYPES
 */
export interface SeparatorPropertyDefinition extends PropertyDefinitionBase {
  type: 'separator';
}

/**
 * Integer property definition
 */
export interface IntegerPropertyDefinition extends PropertyDefinitionBase {
  type: 'integer';
}

/**
 * Float property definition
 */
export interface FloatPropertyDefinition extends PropertyDefinitionBase {
  type: 'float';
}

/**
 * Boolean property definition
 */
export interface BooleanPropertyDefinition extends PropertyDefinitionBase {
  type: 'boolean';
}

/**
 * Date property definition
 */
export interface DatePropertyDefinition extends PropertyDefinitionBase {
  type: 'date';
}

/**
 * DateTime property definition
 */
export interface DateTimePropertyDefinition extends PropertyDefinitionBase {
  type: 'datetime';
}

/**
 * Selection property definition
 *
 * Selection options are defined as an array of [value, label] tuples.
 */
export interface SelectionPropertyDefinition extends PropertyDefinitionBase {
  type: 'selection';
  /** Array of [value, label] tuples */
  selection: Array<[string, string]>;
}

/**
 * Many2one property definition
 *
 * References a single record in another model.
 */
export interface Many2onePropertyDefinition extends PropertyDefinitionBase {
  type: 'many2one';
  /** Target model name (e.g., 'res.partner') */
  comodel: string;
}

/**
 * Many2many property definition
 *
 * References multiple records in another model.
 */
export interface Many2manyPropertyDefinition extends PropertyDefinitionBase {
  type: 'many2many';
  /** Target model name (e.g., 'res.partner') */
  comodel: string;
}

/**
 * Tags property definition
 *
 * Tags selected by key from the definition metadata.
 */
export interface TagsPropertyDefinition extends PropertyDefinitionBase {
  type: 'tags';
  /** Available [key, label, color] options; optional for older callers. */
  tags?: Array<[string, string, number]>;
}

/**
 * Union type of all property definitions
 */
export type PropertyDefinition =
  | CharPropertyDefinition
  | IntegerPropertyDefinition
  | FloatPropertyDefinition
  | BooleanPropertyDefinition
  | DatePropertyDefinition
  | DateTimePropertyDefinition
  | SelectionPropertyDefinition
  | Many2onePropertyDefinition
  | Many2manyPropertyDefinition
  | TagsPropertyDefinition
  | SeparatorPropertyDefinition;

/**
 * Array of property definitions (PropertiesDefinition field type)
 */
export type PropertiesDefinition = PropertyDefinition[];

/**
 * Base property value interface (read format)
 *
 * When reading properties from Odoo, they come as an array of objects
 * with the full property definition plus the value.
 */
export interface PropertyValueBase extends PropertyDefinitionBase {
  type: string;
}

/**
 * Character/Text property value (read format)
 */
export interface CharPropertyValue extends PropertyValueBase {
  type: 'char';
  value: string | false | null;
}

/** Integer property value (read format). */
export interface IntegerPropertyValue extends PropertyValueBase {
  type: 'integer';
  value: number | false | null;
}

/** Float property value (read format). */
export interface FloatPropertyValue extends PropertyValueBase {
  type: 'float';
  value: number | false | null;
}

/** Boolean property value (read format). */
export interface BooleanPropertyValue extends PropertyValueBase {
  type: 'boolean';
  value: boolean | null;
}

/** Date property value (ISO date string, read format). */
export interface DatePropertyValue extends PropertyValueBase {
  type: 'date';
  value: string | false | null;
}

/** DateTime property value (ISO datetime string, read format). */
export interface DateTimePropertyValue extends PropertyValueBase {
  type: 'datetime';
  value: string | false | null;
}

/** Selection property value (read format). */
export interface SelectionPropertyValue extends PropertyValueBase {
  type: 'selection';
  selection: Array<[string, string]>;
  value: string | false | null;
}

/** A relation returned by RPC, including a possibly unavailable display name. */
export type PropertyRelationTuple = [id: number, displayName: string | null];

/** Many2one property value, including ID-only input supported by older callers. */
export interface Many2onePropertyValue extends PropertyValueBase {
  type: 'many2one';
  /** Odoo can return false when the comodel is unavailable. */
  comodel: string | false;
  value: PropertyRelationTuple | number | false | null;
}

/** Many2many property value, including ID-only input supported by older callers. */
export interface Many2manyPropertyValue extends PropertyValueBase {
  type: 'many2many';
  /** Odoo can return false when the comodel is unavailable. */
  comodel: string | false;
  value: PropertyRelationTuple[] | number[] | false | null;
}

/** Tags property value (read format). */
export interface TagsPropertyValue extends PropertyValueBase {
  type: 'tags';
  /** Available [key, label, color] options; optional for older callers. */
  tags?: Array<[string, string, number]>;
  value: string[] | false | null;
}

/** A UI separator has no dictionary value and may omit value on RPC reads. */
export interface SeparatorPropertyValue extends PropertyValueBase {
  type: 'separator';
  value?: false | null;
}

/** Union of supported properties returned by RPC. */
export type PropertyValue =
  | CharPropertyValue
  | IntegerPropertyValue
  | FloatPropertyValue
  | BooleanPropertyValue
  | DatePropertyValue
  | DateTimePropertyValue
  | SelectionPropertyValue
  | Many2onePropertyValue
  | Many2manyPropertyValue
  | TagsPropertyValue
  | SeparatorPropertyValue;

/** Array returned when reading a properties field. */
export type PropertiesReadFormat = PropertyValue[];

/** Dictionary input accepted when writing a properties field. */
export type PropertiesWriteFormat = Record<string, PropertyValueType>;

/** Dictionary-write value alias; relation display tuples are read values only. */
export type PropertyValueType = string | number | boolean | number[] | string[] | null;

/** Raw RPC value, before relational display tuples are normalized for writing. */
export type PropertyReadValueType = PropertyValue['value'];

/**
 * Extract the raw RPC value by name, preserving relation display tuples.
 * Returns undefined for an absent property or a separator without a value.
 */
export function getPropertyValue(
  properties: PropertiesReadFormat,
  propertyName: string,
): PropertyReadValueType {
  const property = properties.find((p) => p.name === propertyName);
  return property ? property.value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelationId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isRelationTuple(value: unknown): value is PropertyRelationTuple {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isRelationId(value[0]) &&
    (typeof value[1] === 'string' || value[1] === null)
  );
}

function toWriteValue(type: string, value: unknown, context: string): PropertyValueType {
  // Check the type even for unset values, so unknown types cannot pass silently.
  switch (type) {
    case 'char':
    case 'date':
    case 'datetime':
    case 'selection':
      if (value === null || value === false || typeof value === 'string') return value;
      break;
    case 'integer':
    case 'float':
      if (value === null || value === false) return value;
      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (type === 'float' || Number.isInteger(value))
      )
        return value;
      break;
    case 'boolean':
      if (value === null || typeof value === 'boolean') return value;
      break;
    case 'tags':
      if (value === null || value === false) return value;
      if (Array.isArray(value)) {
        const tags: unknown[] = Array.from(value);
        if (tags.every((tag) => typeof tag === 'string')) return tags;
      }
      break;
    case 'many2one':
      if (value === null || value === false || isRelationId(value)) return value;
      if (isRelationTuple(value)) return value[0];
      throw new Error(
        `${context}: expected a positive integer ID, [ID, string|null] tuple, false or null`,
      );
    case 'many2many':
      if (value === null || value === false) return value;
      if (Array.isArray(value)) {
        const relations: unknown[] = Array.from(value);
        if (relations.every(isRelationId)) return relations;
        if (relations.every(isRelationTuple)) return relations.map((relation) => relation[0]);
      }
      throw new Error(
        `${context}: expected positive integer IDs or [ID, string|null] tuples, false or null`,
      );
    default:
      throw new Error(`${context}: unsupported property type "${type}"`);
  }
  throw new Error(`${context}: malformed ${type} value`);
}

/**
 * Convert supported server-returned properties to dictionary-write values.
 * Normalizes relational display tuples to IDs and omits separators without
 * mutating the input. Rejects malformed entries instead of dropping values.
 * This only preserves keys exposed by the server read.
 */
export function propertiesToWriteFormat(properties: PropertiesReadFormat): PropertiesWriteFormat {
  if (!Array.isArray(properties)) {
    throw new Error('Properties read format must be an array');
  }
  const entries: Array<[string, PropertyValueType]> = [];
  for (const [index, property] of (properties as unknown[]).entries()) {
    const context = `Property at index ${index}`;
    if (!isRecord(property)) throw new Error(`${context}: expected an object`);
    if (!Object.hasOwn(property, 'name') || typeof property.name !== 'string' || !property.name) {
      throw new Error(`${context}: missing or invalid name`);
    }
    const namedContext = `${context} ("${property.name}")`;
    if (!Object.hasOwn(property, 'type') || typeof property.type !== 'string') {
      throw new Error(`${namedContext}: missing or invalid type`);
    }
    if (property.type === 'separator') continue;
    if (!Object.hasOwn(property, 'value')) throw new Error(`${namedContext}: missing value`);
    entries.push([property.name, toWriteValue(property.type, property.value, namedContext)]);
  }
  // fromEntries creates own data properties even for names such as __proto__.
  return Object.fromEntries(entries);
}

/**
 * Helper to get property definition by name
 *
 * @param definitions - Array of property definitions
 * @param propertyName - Name of the property
 * @returns The property definition, or undefined if not found
 */
export function getPropertyDefinition(
  definitions: PropertiesDefinition,
  propertyName: string,
): PropertyDefinition | undefined {
  return definitions.find((def) => def.name === propertyName);
}
