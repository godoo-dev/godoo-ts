/**
 * URL service — the typed interface exposed via `client.urls.*`
 *
 * Builds links whose resolution depends on the deployed controllers and access policy.
 * Delegates to standalone functions in functions.ts.
 */

import type { ServiceClient } from '../../client/types';
import {
  getBaseUrl as _getBaseUrl,
  getPortalUrl as _getPortalUrl,
  getRecordUrl as _getRecordUrl,
} from './functions';
import type { PortalUrlOptions, PortalUrlResult } from './types';

/**
 * URL service building Odoo record links using deployed controllers and access policy.
 *
 * Access via `client.urls` — never instantiate directly.
 *
 * Three methods:
 * - `getBaseUrl()`   → Odoo instance base URL from system parameters
 * - `getRecordUrl()` → mail-controller redirect link
 * - `getPortalUrl()`  → customer-facing portal link with access token
 */
export class UrlService {
  /** @internal */
  constructor(private client: ServiceClient) {}

  /**
   * Get the base URL of the Odoo instance.
   *
   * Reads the `web.base.url` system parameter. Cached per client instance.
   *
   * @param forceRefresh - Bypass cache and re-read from Odoo
   * @returns Base URL (e.g., 'https://mycompany.odoo.com')
   * @see atlas:base/url-base-url
   */
  async getBaseUrl(forceRefresh = false): Promise<string> {
    return _getBaseUrl(this.client, forceRefresh);
  }

  /**
   * Build a `/mail/view` redirect URL with encoded query parameters.
   * Resolution requires the controller's providing modules and appropriate access;
   * the destination depends on the deployed version and model's routes.
   *
   * @param model - Odoo model name (e.g., 'crm.lead', 'sale.order')
   * @param resId - Record ID
   * @returns Full URL string
   *
   * @example
   * ```typescript
   * const url = await client.urls.getRecordUrl('crm.lead', 42);
   * // → 'https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42'
   * ```
   * @see atlas:base/url-record-basic
   */
  async getRecordUrl(model: string, resId: number): Promise<string> {
    return _getRecordUrl(this.client, model, resId);
  }

  /**
   * Get a portal URL for a record that inherits `portal.mixin`.
   *
   * Portal URLs are customer-facing links with access tokens that allow
   * external users to view records where the model access policy permits it.
   *
   * Common portal models: sale.order, account.move, project.task,
   * purchase.order, helpdesk.ticket.
   *
   * @param model - Odoo model that inherits portal.mixin
   * @param resId - Record ID
   * @param options - Optional: suffix, report type, download flag
   * @returns Portal URL result with url, accessUrl, and accessToken
   *
   * @example
   * ```typescript
   * const result = await client.urls.getPortalUrl('sale.order', 15);
   * // result.url → 'https://mycompany.odoo.com/my/orders/15?access_token=abc-...'
   *
   * // PDF download link
   * const pdf = await client.urls.getPortalUrl('account.move', 7, {
   *   reportType: 'pdf',
   *   download: true,
   * });
   * ```
   * @see atlas:base/url-portal-mixin
   */
  async getPortalUrl(
    model: string,
    resId: number,
    options?: PortalUrlOptions,
  ): Promise<PortalUrlResult> {
    return _getPortalUrl(this.client, model, resId, options);
  }
}
