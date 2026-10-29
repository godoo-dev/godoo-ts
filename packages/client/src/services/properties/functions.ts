/**
 * Properties functions — implementation for the properties service
 */

import type { OdooClient } from '../../client/odoo-client';
import {
  type PropertiesReadFormat,
  type PropertiesWriteFormat,
  propertiesToWriteFormat,
} from '../../types/properties';
import type { PropertiesUpdate } from './types';

/**
 * Read the raw `properties` field value off a record, narrowing the unknown
 * to the {@link PropertiesReadFormat} shape Odoo returns.
 *
 * @internal
 */
function asReadFormat(value: unknown): PropertiesReadFormat {
  if (!Array.isArray(value)) throw new Error('Properties read format must be an array');
  return value as PropertiesReadFormat;
}

/**
 * Merge updates with supported properties returned by the server.
 *
 * Relation display tuples are normalized to IDs before writing. This read/merge/
 * write operation is not atomic and cannot preserve hidden stored keys or prevent
 * concurrent lost updates.
 *
 * @param client - Authenticated Odoo client
 * @param model - Model name (e.g., 'crm.lead')
 * @param recordId - Record ID to update
 * @param propertiesField - Properties field name (e.g., 'lead_properties')
 * @param updates - Properties to update (partial object)
 * @returns Promise that resolves when update is complete
 */
export async function updateSafely(
  client: OdooClient,
  model: string,
  recordId: number,
  propertiesField: string,
  updates: PropertiesUpdate,
): Promise<void> {
  // Read current properties
  const [record] = await client.read(model, [recordId], [propertiesField]);

  if (!record || !Object.hasOwn(record, propertiesField)) {
    throw new Error(`Record ${recordId} not found or has no ${propertiesField} field`);
  }

  // Convert to write format and merge updates
  const currentProps = propertiesToWriteFormat(asReadFormat(record[propertiesField]));
  const mergedProps: PropertiesWriteFormat = { ...currentProps, ...updates };

  // Write back all properties
  await client.write(model, recordId, {
    [propertiesField]: mergedProps,
  });
}

/**
 * Merge updates with each record's supported server-returned properties.
 * All read values and record IDs are validated before writes start. Writes are
 * independent, not atomic; hidden stored keys and concurrent changes cannot be
 * preserved.
 *
 * @param client - Authenticated Odoo client
 * @param model - Model name (e.g., 'crm.lead')
 * @param recordIds - Record IDs to update
 * @param propertiesField - Properties field name (e.g., 'lead_properties')
 * @param updates - Properties to update (partial object)
 * @returns Promise that resolves when all updates are complete
 */
export async function updateSafelyBatch(
  client: OdooClient,
  model: string,
  recordIds: number[],
  propertiesField: string,
  updates: PropertiesUpdate,
): Promise<void> {
  if (recordIds.length === 0) return;

  // Read all current properties
  const records = await client.read(model, recordIds, [propertiesField]);

  // Prepare updates for each record
  const payloads = records.map((record) => {
    if (!Object.hasOwn(record, propertiesField)) {
      throw new Error(`Record ${String(record.id)} has no ${propertiesField} field`);
    }

    const currentProps = propertiesToWriteFormat(asReadFormat(record[propertiesField]));
    const mergedProps: PropertiesWriteFormat = { ...currentProps, ...updates };

    const recordIdRaw = record.id;
    if (typeof recordIdRaw !== 'number' || !Number.isSafeInteger(recordIdRaw) || recordIdRaw <= 0) {
      throw new Error(`Record returned without a positive integer id: ${String(recordIdRaw)}`);
    }

    return { recordId: recordIdRaw, values: { [propertiesField]: mergedProps } };
  });

  // Execute all updates
  await Promise.all(payloads.map(({ recordId, values }) => client.write(model, recordId, values)));
}

/**
 * Get current properties in write format for a record
 *
 * Relation display tuples are normalized to IDs; separators are omitted.
 * Only supported properties exposed by the server read can be represented.
 *
 * @param client - Authenticated Odoo client
 * @param model - Model name (e.g., 'crm.lead')
 * @param recordId - Record ID
 * @param propertiesField - Properties field name (e.g., 'lead_properties')
 * @returns Current properties in write format
 */
export async function getCurrentWriteFormat(
  client: OdooClient,
  model: string,
  recordId: number,
  propertiesField: string,
): Promise<PropertiesWriteFormat> {
  const [record] = await client.read(model, [recordId], [propertiesField]);

  if (!record || !Object.hasOwn(record, propertiesField)) {
    throw new Error(`Record ${recordId} not found or has no ${propertiesField} field`);
  }

  return propertiesToWriteFormat(asReadFormat(record[propertiesField]));
}
