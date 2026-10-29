/**
 * Properties service — the typed interface exposed via `client.properties.*`
 *
 * This is the public API shape. Implementation delegates to standalone
 * functions in functions.ts, binding the client reference.
 */

import type { OdooClient } from '../../client/odoo-client';
import type { PropertiesWriteFormat } from '../../types/properties';
import {
  getCurrentWriteFormat as _getCurrentWriteFormat,
  updateSafely as _updateSafely,
  updateSafelyBatch as _updateSafelyBatch,
} from './functions';
import type { PropertiesUpdate } from './types';

/**
 * Properties service for read/merge/write updates of Odoo properties fields.
 *
 * Access via `client.properties` — never instantiate directly.
 *
 * Properties dictionary writes replace stored values. This service reads and
 * normalizes supported server-returned properties, then merges changes and writes
 * the result. It cannot preserve hidden stored keys or prevent concurrent lost
 * updates. Reads and writes are not atomic, including across a batch.
 */
export class PropertiesService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Merge updates with supported server-returned properties on a record.
   *
   * Relation display tuples are normalized to IDs. This read/merge/write
   * operation is not atomic and only preserves values exposed by the read.
   *
   * @param model - Model name (e.g., 'crm.lead')
   * @param recordId - Record ID to update
   * @param propertiesField - Properties field name (e.g., 'lead_properties')
   * @param updates - Properties to update (partial object)
   * @returns Promise that resolves when update is complete
   *
   * @example
   * ```typescript
   * // Update priority, preserving other supported server-returned values
   * await client.properties.updateSafely(
   *   'crm.lead',
   *   leadId,
   *   'lead_properties',
   *   { priority: 'critical' }
   * );
   * ```
   */
  async updateSafely(
    model: string,
    recordId: number,
    propertiesField: string,
    updates: PropertiesUpdate,
  ): Promise<void> {
    return _updateSafely(this.client, model, recordId, propertiesField, updates);
  }

  /**
   * Merge updates with supported server-returned properties on each record.
   *
   * Applies the same property updates to multiple records while preserving
   * values exposed by each read. Validates all read values and record IDs before
   * starting writes; the independent writes are not atomic.
   *
   * @param model - Model name (e.g., 'crm.lead')
   * @param recordIds - Record IDs to update
   * @param propertiesField - Properties field name (e.g., 'lead_properties')
   * @param updates - Properties to update (partial object)
   * @returns Promise that resolves when all updates are complete
   *
   * @example
   * ```typescript
   * // Update priority on multiple leads
   * await client.properties.updateSafelyBatch(
   *   'crm.lead',
   *   [123, 456, 789],
   *   'lead_properties',
   *   { priority: 'high', updated_by_batch: true }
   * );
   * ```
   */
  async updateSafelyBatch(
    model: string,
    recordIds: number[],
    propertiesField: string,
    updates: PropertiesUpdate,
  ): Promise<void> {
    return _updateSafelyBatch(this.client, model, recordIds, propertiesField, updates);
  }

  /**
   * Get current properties in write format for a record.
   *
   * Normalizes relation display tuples to IDs and omits separators.
   * Includes only supported properties exposed by the server read.
   *
   * @param model - Model name (e.g., 'crm.lead')
   * @param recordId - Record ID
   * @param propertiesField - Properties field name (e.g., 'lead_properties')
   * @returns Current properties in write format
   *
   * @example
   * ```typescript
   * const current = await client.properties.getCurrentWriteFormat(
   *   'crm.lead',
   *   leadId,
   *   'lead_properties'
   * );
   * console.log(`Current priority: ${current.priority}`);
   * ```
   */
  async getCurrentWriteFormat(
    model: string,
    recordId: number,
    propertiesField: string,
  ): Promise<PropertiesWriteFormat> {
    return _getCurrentWriteFormat(this.client, model, recordId, propertiesField);
  }
}
