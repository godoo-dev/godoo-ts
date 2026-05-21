/**
 * Types for Properties service
 */

import type { PropertyValueType } from '../../types/properties';

/**
 * Partial properties update object.
 *
 * Keys are property technical names; values are any of the Odoo property
 * value types (string, number, boolean, number[], string[], or `false`).
 */
export type PropertiesUpdate = Record<string, PropertyValueType>;
