import type { OdooCrudClient } from '../../client/types';
import { type ErrorJSON, OdooError, OdooValidationError } from '../../types/errors';
import {
  inspectModulePrerequisites,
  type ModuleInspectionOptions,
  type ModulePrerequisiteInspection,
} from './inspection';
import type { ModuleInfo } from './module-types';

export interface ModuleOperationOptions extends ModuleInspectionOptions {
  /** Total attempts, including the first. Integer 1–5; default 3. */
  maxAttempts?: number;
  /** Delay only after a classified cron lock. Integer 0–30000; default 5000. */
  retryDelayMs?: number;
}

export interface ModuleOperationResult extends ModuleInfo {
  operation: 'install' | 'upgrade';
  /** A lifecycle RPC completed; conservative, not a measured schema diff. */
  changed: boolean;
  schemaInvalidated: boolean;
  attempts: number;
  prerequisites: ModulePrerequisiteInspection;
}

/** Refusal/incomplete verification, distinct from unchanged propagated RPC errors. */
export class ModuleLifecycleError extends OdooError {
  constructor(
    message: string,
    public readonly phase: 'prerequisite' | 'stale' | 'postcondition',
    public readonly inspection: ModulePrerequisiteInspection,
    public readonly schemaInvalidated: boolean,
  ) {
    super(message);
    this.name = 'ModuleLifecycleError';
    Object.setPrototypeOf(this, ModuleLifecycleError.prototype);
  }

  override toJSON(): ErrorJSON {
    return {
      error: 'MODULE_LIFECYCLE_ERROR',
      message: this.message,
      details: {
        phase: this.phase,
        inspection: this.inspection,
        schemaInvalidated: this.schemaInvalidated,
      },
    };
  }
}

// Odoo 17 ir_module._button_immediate_function raises this UserError before
// invoking the lifecycle function/committing. Never classify by broad fragments.
const CRON_LOCK =
  'Odoo is currently processing a scheduled action.\n' +
  'Module operations are not possible at this time, ' +
  'please try again later or contact your system administrator.';

function isCronLock(error: unknown): boolean {
  return (
    error instanceof OdooValidationError &&
    error.data?.name === 'odoo.exceptions.UserError' &&
    error.message === CRON_LOCK &&
    error.data.message === CRON_LOCK
  );
}

function boundedInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new TypeError(`${label} must be an integer between ${min} and ${max}`);
  return value;
}

function requireClosure(
  inspection: ModulePrerequisiteInspection,
  installed: boolean,
  phase: ModuleLifecycleError['phase'],
  invalidated: boolean,
): void {
  if (
    !inspection.closureComplete ||
    inspection.diagnostics.length ||
    inspection.cycleEdges.length ||
    inspection.modules.some(
      (module) =>
        module.id === null ||
        (module.status !== 'installed' && (installed || module.status !== 'uninstalled')),
    )
  ) {
    throw new ModuleLifecycleError(
      `Module ${phase} failed: dependency closure must be complete with ${installed ? 'installed' : 'installed or uninstalled'} states`,
      phase,
      inspection,
      invalidated,
    );
  }
}

function requireIdentities(
  before: ModulePrerequisiteInspection,
  after: ModulePrerequisiteInspection,
  phase: ModuleLifecycleError['phase'],
  invalidated: boolean,
): void {
  for (const previous of before.modules) {
    const current = after.modules.find((module) => module.name === previous.name);
    if (!current || current.id !== previous.id) {
      throw new ModuleLifecycleError(
        `Module '${previous.name}' changed identity during lifecycle operation`,
        phase,
        after,
        invalidated,
      );
    }
  }
}

/**
 * Supported Odoo 17/18 _button_immediate_function/next completion responses.
 * Registered todo windows come from action.read() and action_launch adds
 * disable_log. A module-operation wizard is pending work, even if every module
 * already reports installed. Unknown/custom responses fail closed.
 */
function isCompletionResponse(response: unknown): boolean {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  const action = response as Record<string, unknown>;
  if (Object.keys(action).length === 0) return true; // next() or {} after commit
  if (
    ['error', 'errors', 'warning', 'refused', 'deferred', 'status', 'success'].some((key) =>
      Object.hasOwn(action, key),
    )
  )
    return false;
  const model = action.res_model;
  if (
    typeof model === 'string' &&
    (model.startsWith('base.module.') || model === 'ir.module.module')
  )
    return false;
  if (action.type === 'ir.actions.client') return action.tag === 'reload';
  if (action.type === 'ir.actions.act_url')
    return (action.url === '/web' || action.url === '/odoo') && action.target === 'self';
  if (action.type !== 'ir.actions.act_window') return false;
  const context = action.context;
  return (
    typeof action.id === 'number' &&
    Number.isSafeInteger(action.id) &&
    action.id > 0 &&
    typeof model === 'string' &&
    /^[a-z_][a-z0-9_.]*$/.test(model) &&
    typeof action.view_mode === 'string' &&
    action.view_mode.split(',').every((mode) => /^[a-z][a-z0-9_]*$/.test(mode)) &&
    typeof action.target === 'string' &&
    ['current', 'new', 'inline', 'fullscreen', 'main'].includes(action.target) &&
    !!context &&
    typeof context === 'object' &&
    !Array.isArray(context) &&
    (context as Record<string, unknown>).disable_log === true
  );
}

/** Internal shared implementation; ModuleManager retains the guarded client call. */
export async function performModuleOperation(
  client: Pick<OdooCrudClient, 'call' | 'searchRead'>,
  operation: ModuleOperationResult['operation'],
  name: string,
  options: ModuleOperationOptions,
  onDispatch: () => void,
): Promise<ModuleOperationResult> {
  const maxAttempts = boundedInteger(options.maxAttempts ?? 3, 1, 5, 'maxAttempts');
  const retryDelayMs = boundedInteger(options.retryDelayMs ?? 5000, 0, 30000, 'retryDelayMs');
  const kwargs = options.context === undefined ? {} : { context: options.context };
  const before = await inspectModulePrerequisites(client, [name], options);
  requireClosure(before, false, 'prerequisite', false);
  const target = before.modules.find((module) => module.name === name);
  if (!target || target.id === null)
    throw new ModuleLifecycleError(`No visible module '${name}'`, 'prerequisite', before, false);
  if (operation === 'upgrade' && target.state !== 'installed')
    throw new ModuleLifecycleError(
      `Module '${name}' must be installed to upgrade`,
      'prerequisite',
      before,
      false,
    );

  async function readTarget(
    inspection: ModulePrerequisiteInspection,
    phase: ModuleLifecycleError['phase'],
    invalidated: boolean,
  ): Promise<ModuleInfo> {
    const rows = await client.searchRead<Record<string, unknown>>(
      'ir.module.module',
      [['name', '=', name]],
      {
        ...kwargs,
        fields: ['id', 'name', 'state', 'shortdesc', 'summary', 'installed_version', 'application'],
        order: 'id',
      },
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    const expected = inspection.modules.find((module) => module.name === name);
    if (
      !Array.isArray(rows) ||
      rows.length !== 1 ||
      !row ||
      row.id !== target?.id ||
      row.name !== name ||
      row.state !== expected?.state
    ) {
      throw new ModuleLifecycleError(
        `Module '${name}' changed or became hidden while verifying its state`,
        phase,
        inspection,
        invalidated,
      );
    }
    return row as unknown as ModuleInfo;
  }

  if (operation === 'install' && target.state === 'installed') {
    requireClosure(before, true, 'prerequisite', false);
    return {
      ...(await readTarget(before, 'stale', false)),
      operation,
      changed: false,
      schemaInvalidated: false,
      attempts: 0,
      prerequisites: before,
    };
  }

  const names = before.modules.map((module) => module.name);
  let attempts = 0;
  let response: unknown;
  let current = before;
  while (attempts < maxAttempts) {
    if (attempts > 0) {
      current = await inspectModulePrerequisites(client, names, options);
      requireClosure(current, false, 'stale', true);
      requireIdentities(before, current, 'stale', true);
      // Another actor may have completed an install, but never repeat it blindly.
      if (current.modules.find((module) => module.name === name)?.state !== target.state)
        throw new ModuleLifecycleError(
          `Module '${name}' changed state before retry; inspect and replan`,
          'stale',
          current,
          true,
        );
    }
    await readTarget(current, 'stale', attempts > 0);
    attempts++;
    onDispatch();
    try {
      response = await client.call(
        'ir.module.module',
        `button_immediate_${operation}`,
        [[target.id]],
        kwargs,
      );
      break;
    } catch (error) {
      if (!isCronLock(error) || attempts === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  // Include prior closure members as well as any dependencies newly discovered
  // after Odoo's registry/catalog update. Do not hide a disappeared old edge.
  const after = await inspectModulePrerequisites(client, names, options);
  requireClosure(after, true, 'postcondition', true);
  requireIdentities(before, after, 'postcondition', true);
  if (!isCompletionResponse(response))
    throw new ModuleLifecycleError(
      `Module '${name}' lifecycle returned an unsupported, refused or deferred action; completion is unverified`,
      'postcondition',
      after,
      true,
    );
  return {
    ...(await readTarget(after, 'postcondition', true)),
    operation,
    changed: true,
    schemaInvalidated: true,
    attempts,
    prerequisites: after,
  };
}
