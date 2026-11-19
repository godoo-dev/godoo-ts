/**
 * URL generation functions for Odoo records.
 *
 * Uses the deployed mail controller to resolve record links. Availability and
 * destinations depend on installed modules, version and access policy.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/controllers/mail.py
 * @see https://github.com/odoo/odoo/blob/17.0/addons/portal/models/portal_mixin.py
 * @see atlas:base/url-record-basic
 */

import debug from 'debug';
import type { ServiceClient } from '../../client/types';
import type { PortalUrlOptions, PortalUrlResult } from './types';

const log = debug('odoo-client:urls');

/**
 * Cache for web.base.url — it rarely changes during a session.
 * Key: client instance (via WeakMap), Value: base URL string.
 */
const baseUrlCache = new WeakMap<ServiceClient, string>();

/**
 * Get the base URL of the Odoo instance.
 *
 * Reads the `web.base.url` system parameter from `ir.config_parameter`.
 * This is the canonical base URL that Odoo uses for generating links
 * in emails, portal pages, and notifications.
 *
 * Result is cached per client instance — call with `forceRefresh: true`
 * to bypass the cache.
 *
 * @param client - Authenticated ServiceClient instance
 * @param forceRefresh - Bypass cache and re-read from Odoo
 * @returns Base URL string (e.g., 'https://mycompany.odoo.com')
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_config_parameter.py
 * @see atlas:base/url-base-url
 */
export async function getBaseUrl(client: ServiceClient, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = baseUrlCache.get(client);
    if (cached) {
      log('base URL from cache: %s', cached);
      return cached;
    }
  }

  const baseUrl = await client.call<string>(
    'ir.config_parameter',
    'get_param',
    ['web.base.url'],
    {},
    { safetyLevel: 'READ' },
  );

  if (!baseUrl) {
    throw new Error(
      'Could not read web.base.url from Odoo. ' +
        'Ensure the system parameter exists (Settings → Technical → Parameters → System Parameters).',
    );
  }

  // Strip trailing slash for consistent URL building
  const normalized = baseUrl.replace(/\/+$/, '');
  baseUrlCache.set(client, normalized);
  log('base URL fetched: %s', normalized);
  return normalized;
}

/**
 * Build a mail redirect URL using encoded model and record-ID query parameters.
 * Resolution depends on controller availability, model routes and access rights.
 *
 * @param client - Authenticated ServiceClient instance
 * @param model  - Odoo model name (e.g., 'crm.lead', 'sale.order')
 * @param resId  - Record ID
 * @returns Full URL string (e.g., 'https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42')
 *
 * @example
 * ```typescript
 * const url = await getRecordUrl(client, 'crm.lead', 42);
 * // → 'https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42'
 * ```
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/controllers/mail.py — mail_action_view
 * @see atlas:base/url-record-basic
 */
export async function getRecordUrl(
  client: ServiceClient,
  model: string,
  resId: number,
): Promise<string> {
  const baseUrl = await getBaseUrl(client);
  const params = new URLSearchParams({ model, res_id: String(resId) });
  const url = `${baseUrl}/mail/view?${params.toString()}`;
  log('record URL: %s', url);
  return url;
}

/**
 * Get a portal URL for a record that inherits from `portal.mixin`.
 *
 * Portal URLs are customer-facing links with access tokens that allow
 * external users to view records where model access policy permits it.
 * Common portal models:
 * - sale.order → /my/orders/{id}
 * - account.move → /my/invoices/{id}
 * - project.task → /my/tasks/{id}
 * - purchase.order → /my/purchase/{id}
 * - helpdesk.ticket → /my/tickets/{id}
 *
 * Returns the portal URL with access token, plus raw `access_url` and token
 * for custom URL building.
 *
 * Throws if the model doesn't have `access_url` / `access_token` fields
 * (i.e., doesn't inherit from portal.mixin).
 *
 * @param client - Authenticated ServiceClient instance
 * @param model  - Odoo model that inherits portal.mixin
 * @param resId  - Record ID
 * @param options - Optional: suffix, report type, download flag
 * @returns Portal URL result with url, accessUrl, and accessToken
 *
 * @example
 * ```typescript
 * const result = await getPortalUrl(client, 'sale.order', 15);
 * // result.url → 'https://mycompany.odoo.com/my/orders/15?access_token=abc-123-...'
 *
 * // Download a PDF invoice
 * const invoice = await getPortalUrl(client, 'account.move', 7, {
 *   reportType: 'pdf',
 *   download: true,
 * });
 * // invoice.url → 'https://mycompany.odoo.com/my/invoices/7?access_token=...&report_type=pdf&download=true'
 * ```
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/portal/models/portal_mixin.py — get_portal_url
 * @see atlas:base/url-portal-mixin
 */
export async function getPortalUrl(
  client: ServiceClient,
  model: string,
  resId: number,
  options?: PortalUrlOptions,
): Promise<PortalUrlResult> {
  const baseUrl = await getBaseUrl(client);

  // Read access_url and access_token from the record.
  // Missing tokens are created explicitly below, after validating access_url.
  // atlas: base/url-portal-mixin
  const records = await client.read<{
    access_url: string;
    access_token: string | false;
  }>(model, resId, ['access_url', 'access_token']);

  if (!records.length) {
    throw new Error(`Record ${model}(${resId}) not found.`);
  }

  const record = records[0];

  if (!record) throw new Error(`Record ${model}:${resId} not readable`);
  if (!record.access_url || record.access_url === '#') {
    throw new Error(
      `Model '${model}' does not provide a portal URL (access_url is '${record.access_url}'). ` +
        'The model likely does not inherit from portal.mixin, or _compute_access_url is not implemented. ' +
        'Use getRecordUrl() instead for a mail-controller redirect link; availability and destination depend on the deployment.',
    );
  }

  // If access_token is not set, trigger token generation by calling _portal_ensure_token
  let accessToken = record.access_token;
  if (!accessToken) {
    log('no access_token on %s(%d), triggering _portal_ensure_token', model, resId);
    accessToken = await client.call<string>(model, '_portal_ensure_token', [[resId]]);
  }

  // Build the full portal URL following Odoo's get_portal_url pattern
  const suffix = options?.suffix ?? '';
  const queryParts: string[] = [];
  queryParts.push(`access_token=${encodeURIComponent(accessToken as string)}`);

  if (options?.reportType) {
    queryParts.push(`report_type=${encodeURIComponent(options.reportType)}`);
  }
  if (options?.download) {
    queryParts.push('download=true');
  }

  const accessUrl = record.access_url as string;
  const url = `${baseUrl}${accessUrl}${suffix}?${queryParts.join('&')}`;
  log('portal URL: %s', url);

  return {
    url,
    accessUrl,
    accessToken: accessToken as string,
  };
}
