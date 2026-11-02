/** Shared native CRUD, services and optional safety for direct and bound clients. */

import type { Domain, RpcArg } from '../rpc/types';
import {
  inferSafetyLevel,
  type OperationInfo,
  resolveSafetyContext,
  type SafetyContext,
} from '../safety';
import { AccountingService } from '../services/accounting/accounting-service';
import { AttendanceService } from '../services/attendance/attendance-service';
import { CdcService } from '../services/cdc/cdc-service';
import { MailService } from '../services/mail/mail-service';
import { ModuleManager } from '../services/modules/module-manager';
import { PropertiesService } from '../services/properties/properties-service';
import { TimesheetsService } from '../services/timesheets/timesheets-service';
import { UrlService } from '../services/urls/url-service';
import { OdooSafetyError } from '../types/errors';
import type {
  CallOptions,
  ClientSession,
  SearchOptions,
  SearchReadOptions,
  ServiceClient,
} from './types';

/** Portable SDK implementation shared by transport-specific clients. */
export abstract class OdooClientCore implements ServiceClient {
  private safetyContext: SafetyContext | null | undefined;

  protected constructor(safety?: SafetyContext | null) {
    this.safetyContext = safety;
  }

  abstract getSession(): ClientSession | null;

  protected abstract executeRpc<T>(
    model: string,
    method: string,
    args: RpcArg[],
    kwargs: Record<string, unknown>,
  ): Promise<T>;

  /** Transport-specific readiness checks run before the convenience safety guard. */
  protected assertReady(): void {}

  protected safetyTarget(): string | undefined {
    return undefined;
  }

  // ── Service accessors (lazy) ────────────────────────────────────────
  //
  // Each service is created on first access and reused thereafter.
  // Adding a service: private field + getter + import. That's it.

  private _mail?: MailService;

  /**
   * Mail / Chatter service — post messages and notes on records.
   *
   * ```typescript
   * await client.mail.postInternalNote('crm.lead', 42, '<p>Called customer.</p>');
   * await client.mail.postOpenMessage('res.partner', 7, '<p>Order shipped.</p>');
   * ```
   */
  get mail(): MailService {
    if (!this._mail) this._mail = new MailService(this);
    return this._mail;
  }

  private _modules?: ModuleManager;

  /**
   * Module management — install, uninstall, list, and check Odoo modules.
   *
   * ```typescript
   * if (await client.modules.isModuleInstalled('sale')) { ... }
   * await client.modules.installModule('project');
   * ```
   */
  get modules(): ModuleManager {
    if (!this._modules) this._modules = new ModuleManager(this);
    return this._modules;
  }

  private _attendance?: AttendanceService;

  /**
   * Attendance service — clock in/out and presence tracking.
   *
   * Requires the `hr_attendance` module to be installed.
   *
   * ```typescript
   * await client.attendance.clockIn();
   * const status = await client.attendance.getStatus();
   * await client.attendance.clockOut();
   * ```
   */
  get attendance(): AttendanceService {
    if (!this._attendance) this._attendance = new AttendanceService(this);
    return this._attendance;
  }

  private _timesheets?: TimesheetsService;

  /**
   * Timesheets service — timer-based and manual time tracking on projects.
   *
   * Requires the `hr_timesheet` module to be installed.
   *
   * ```typescript
   * // Timer workflow
   * const entry = await client.timesheets.startTimer({
   *   description: 'Feature work',
   *   projectId: 5,
   * });
   * // ... later ...
   * await client.timesheets.stopTimer(entry.id);
   *
   * // Manual logging
   * await client.timesheets.logTime({
   *   description: 'Code review',
   *   projectId: 5,
   *   hours: 1.5,
   * });
   * ```
   */
  get timesheets(): TimesheetsService {
    if (!this._timesheets) this._timesheets = new TimesheetsService(this);
    return this._timesheets;
  }

  private _accounting?: AccountingService;

  /**
   * Accounting service — cash discovery, reconciliation tracing, partner resolution.
   *
   * Requires the `account` module (Invoicing/Accounting) to be installed.
   *
   * ```typescript
   * const cashIds = await client.accounting.getCashAccountIds();
   * const balance = await client.accounting.getCashBalance(cashIds, '2025-06-30');
   * const partner = await client.accounting.resolvePartnerFromMove(moveId, cashIds);
   * const daysToPay = await client.accounting.calculateDaysToPay(invoiceId);
   * ```
   */
  get accounting(): AccountingService {
    if (!this._accounting) this._accounting = new AccountingService(this);
    return this._accounting;
  }

  private _urls?: UrlService;

  /**
   * URL service — generate links to Odoo records that work across all versions.
   *
   * Uses Odoo's built-in `/mail/view` redirect controller (same as notification emails).
   * No need to worry about hash-based vs path-based URL formats.
   *
   * ```typescript
   * // Backend link (any model, any Odoo version)
   * const url = await client.urls.getRecordUrl('crm.lead', 42);
   * // → 'https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42'
   *
   * // Portal link (models with portal.mixin)
   * const portal = await client.urls.getPortalUrl('sale.order', 15);
   * // → { url: 'https://mycompany.odoo.com/my/orders/15?access_token=...' }
   * ```
   */
  get urls(): UrlService {
    if (!this._urls) this._urls = new UrlService(this);
    return this._urls;
  }

  private _properties?: PropertiesService;

  /**
   * Properties service — parent-scoped bindings and read/merge/write helpers.
   *
   * Normalizes and preserves supported server-returned values while merging
   * updates. It cannot preserve hidden stored keys or prevent concurrent lost
   * updates; reads and writes are not atomic.
   *
   * ```typescript
   * // Update while preserving other supported server-returned properties
   * await client.properties.updateSafely(
   *   'crm.lead',
   *   leadId,
   *   'lead_properties',
   *   { priority: 'critical' }
   * );
   *
   * // Batch update multiple records
   * await client.properties.updateSafelyBatch(
   *   'crm.lead',
   *   [123, 456],
   *   'lead_properties',
   *   { priority: 'high' }
   * );
   * ```
   */
  get properties(): PropertiesService {
    if (!this._properties) this._properties = new PropertiesService(this);
    return this._properties;
  }

  private _cdc?: CdcService;

  /**
   * CDC (Change Data Capture) service — stream tracked field changes.
   *
   * Built on Odoo's native `mail.tracking.value` audit log.
   * Requires models with `_inherit = 'mail.thread'` and `tracking=True` fields.
   *
   * ```typescript
   * // Diagnose coverage
   * const info = await client.cdc.check('contract.contract');
   *
   * // Full history for one record
   * const events = await client.cdc.getHistory('contract.contract', 42);
   *
   * // Stream all changes (for migration / sync)
   * for await (const ev of client.cdc.getFeed('contract.contract', { since: '2025-01-01' })) {
   *   console.log(ev.recordId, ev.field.name, ev.old.display, '→', ev.new.display);
   * }
   * ```
   */
  get cdc(): CdcService {
    if (!this._cdc) this._cdc = new CdcService(this);
    return this._cdc;
  }

  /**
   * Override safety context for this client instance.
   * Pass null to explicitly disable, undefined to use global default.
   */
  setSafetyContext(ctx: SafetyContext | null | undefined): void {
    this.safetyContext = ctx;
  }

  // ── Safety ──────────────────────────────────────────────────────────

  /**
   * Check safety guard for an operation.
   * Throws OdooSafetyError if the operation is blocked.
   */
  private async guard(op: OperationInfo): Promise<void> {
    const ctx = resolveSafetyContext(this.safetyContext);
    if (!ctx) return;
    if (op.level === 'READ') return;

    const confirmed = await ctx.confirm(op);
    if (!confirmed) {
      throw new OdooSafetyError(op);
    }
  }

  // ── RPC ─────────────────────────────────────────────────────────────

  /**
   * Make a raw RPC call to a model method
   *
   * Safety level is inferred from the method name:
   * - Known read methods (search, read, fields_get, etc.) → READ (never blocked)
   * - unlink → DELETE
   * - Everything else → WRITE
   *
   * Override with `options.safetyLevel` for methods the inference gets wrong.
   *
   * @param model - Model name (e.g., 'res.partner')
   * @param method - Method name (e.g., 'search', 'read')
   * @param args - Positional arguments
   * @param kwargs - Keyword arguments (context, etc)
   * @param options - Additional options (safetyLevel override)
   * @returns Method result, typed as T
   */
  async call<T = unknown>(
    model: string,
    method: string,
    args: RpcArg[] = [],
    kwargs: Record<string, unknown> = {},
    options?: CallOptions,
  ): Promise<T> {
    this.assertReady();

    const level = options?.safetyLevel ?? inferSafetyLevel(method);
    await this.guard({
      name: `odoo.${method}`,
      level,
      model,
      description: `${model}.${method}()`,
      target: this.safetyTarget(),
    });

    return this.executeRpc<T>(model, method, args, kwargs);
  }

  // ── CRUD ────────────────────────────────────────────────────────────

  /**
   * Search for records
   *
   * @param model - Model name
   * @param domain - Search domain (e.g., [['active', '=', true]])
   * @param options - Search options (offset, limit, order, etc)
   * @returns Array of record IDs
   */
  async search(model: string, domain: Domain = [], options: SearchOptions = {}): Promise<number[]> {
    const kwargs: Record<string, unknown> = {};
    if (options.offset !== undefined) kwargs.offset = options.offset;
    if (options.limit !== undefined) kwargs.limit = options.limit;
    if (options.order !== undefined) kwargs.order = options.order;
    if (options.context !== undefined) kwargs.context = options.context;

    return this.call<number[]>(model, 'search', [domain], kwargs);
  }

  /**
   * Read records
   *
   * @param model - Model name
   * @param ids - Record IDs to read
   * @param fields - Fields to read (empty = all fields)
   * @returns Array of record objects
   */
  async read<T extends object = Record<string, unknown>>(
    model: string,
    ids: number | number[],
    fields: string[] = [],
    context?: Record<string, unknown>,
  ): Promise<T[]> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const kwargs: Record<string, unknown> = {};
    if (context !== undefined) kwargs.context = context;
    return this.call<T[]>(model, 'read', [idArray, fields], kwargs);
  }

  /**
   * Search and read records in one call
   *
   * @param model - Model name
   * @param domain - Search domain
   * @param options - Search and read options
   * @returns Array of record objects
   */
  async searchRead<T extends object = Record<string, unknown>>(
    model: string,
    domain: Domain = [],
    options: SearchReadOptions = {},
  ): Promise<T[]> {
    const kwargs: Record<string, unknown> = {};
    if (options.fields !== undefined && options.fields.length > 0) {
      kwargs.fields = options.fields;
    }
    if (options.offset !== undefined) kwargs.offset = options.offset;
    if (options.limit !== undefined) kwargs.limit = options.limit;
    if (options.order !== undefined) kwargs.order = options.order;
    if (options.context !== undefined) kwargs.context = options.context;

    return this.call<T[]>(model, 'search_read', [domain], kwargs);
  }

  /**
   * Create a new record
   *
   * @param model - Model name
   * @param values - Record values
   * @param context - Optional context for creation
   * @returns Created record ID
   */
  async create(
    model: string,
    values: Record<string, unknown>,
    context: Record<string, unknown> = {},
  ): Promise<number> {
    return this.call<number>(model, 'create', [values], { context });
  }

  /**
   * Update records
   *
   * @param model - Model name
   * @param ids - Record IDs to update
   * @param values - Values to update
   * @param context - Optional context for update
   * @returns True if successful
   */
  async write(
    model: string,
    ids: number | number[],
    values: Record<string, unknown>,
    context: Record<string, unknown> = {},
  ): Promise<boolean> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.call<boolean>(model, 'write', [idArray, values], { context });
  }

  /**
   * Delete records
   *
   * @param model - Model name
   * @param ids - Record IDs to delete
   * @returns True if successful
   */
  async unlink(model: string, ids: number | number[]): Promise<boolean> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.call<boolean>(model, 'unlink', [idArray]);
  }

  /**
   * Count matching records
   *
   * @param model - Model name
   * @param domain - Search domain
   * @returns Number of matching records
   */
  async searchCount(
    model: string,
    domain: Domain = [],
    context?: Record<string, unknown>,
  ): Promise<number> {
    const kwargs: Record<string, unknown> = {};
    if (context !== undefined) kwargs.context = context;
    return this.call<number>(model, 'search_count', [domain], kwargs);
  }
}
