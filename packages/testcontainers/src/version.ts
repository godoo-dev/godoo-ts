/**
 * Normalise a raw ODOO_VERSION value into the full dotted form.
 *
 * @example
 *   normaliseOdooVersion('18')   -> '18.0'
 *   normaliseOdooVersion('18.0') -> '18.0'
 */
export function normaliseOdooVersion(raw: string | undefined): string {
  if (!raw) return '18.0';
  if (raw.includes('.')) return raw;
  return `${raw}.0`;
}
