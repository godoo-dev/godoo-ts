/** Versioned effect vocabulary. These declarations never grant RPC authority. */
export const EFFECT_CONTRACT_VERSION: 1 = 1;
export type Effect =
  | 'read'
  | 'mutate'
  | 'destructive'
  | 'external'
  | 'schema'
  | 'disclose'
  | 'unknown';
export const EFFECTS: readonly Effect[] = Object.freeze([
  'read',
  'mutate',
  'destructive',
  'external',
  'schema',
  'disclose',
  'unknown',
] as const);
export type EffectSet = readonly Effect[];

/** Unknown is the conservative top: potentially destructive, external and schema-changing. */
export function composeEffects(...sets: readonly EffectSet[]): EffectSet {
  if (
    sets.some(
      (set) => !Array.isArray(set) || Array.from(set).some((effect) => !EFFECTS.includes(effect)),
    )
  ) {
    return EFFECTS;
  }
  const union = new Set(sets.flat());
  if ([...union].some((effect) => !EFFECTS.includes(effect)) || union.has('unknown')) {
    return EFFECTS;
  }
  return Object.freeze(EFFECTS.filter((effect) => union.has(effect)));
}

export interface RpcEffectDeclaration {
  /** Exact model and method; wildcard attestations are deliberately unsupported. */
  readonly model: string;
  readonly method: string;
  readonly effects: EffectSet;
}

export interface RpcEffectManifest {
  readonly schemaVersion: typeof EFFECT_CONTRACT_VERSION;
  /** Host-selected provenance/revision, never interpreted as an authorization token. */
  readonly source: string;
  readonly declarations: readonly RpcEffectDeclaration[];
}

function validManifest(value: RpcEffectManifest): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.schemaVersion === EFFECT_CONTRACT_VERSION &&
    typeof value.source === 'string' &&
    value.source.length > 0 &&
    Array.isArray(value.declarations) &&
    Array.from(value.declarations).every(
      (item: RpcEffectDeclaration) =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.model === 'string' &&
        item.model.length > 0 &&
        typeof item.method === 'string' &&
        item.method.length > 0 &&
        !item.model.includes('*') &&
        !item.method.includes('*') &&
        Array.isArray(item.effects) &&
        Array.from(item.effects).every((effect: Effect) => EFFECTS.includes(effect)),
    )
  );
}

/** Library-owned lower bounds only. A familiar method name never proves read-only behavior. */
function rpcMinimum(model: string, method: string): EffectSet {
  if (
    [
      'ir.model',
      'ir.model.fields',
      'ir.model.constraint',
      'ir.module.module',
      'ir.module.module.dependency',
    ].includes(model) &&
    ['create', 'write', 'unlink', 'copy'].includes(method)
  ) {
    return method === 'unlink' ? ['mutate', 'destructive', 'schema'] : ['mutate', 'schema'];
  }
  if (
    ['search', 'read', 'search_read', 'search_count', 'fields_get', 'read_group'].includes(method)
  ) {
    return ['read'];
  }
  if (method === 'unlink') return ['mutate', 'destructive'];
  if (method === 'create' || method === 'write' || method === 'copy') return ['mutate'];
  if (method === 'message_post') return ['mutate', 'external'];
  if (method === '_portal_ensure_token') return ['mutate', 'disclose'];
  if (
    model === 'ir.module.module' &&
    ['button_immediate_install', 'button_immediate_upgrade', 'button_immediate_uninstall'].includes(
      method,
    )
  ) {
    // Installation hooks execute arbitrary server/addon code.
    return ['read', 'mutate', 'destructive', 'external', 'schema'];
  }
  return [];
}

/**
 * Call on the authenticated HOST for every actual RPC, using host-trusted manifests.
 * Guest helper names, safetyLevel and declarations are not inputs to authorization.
 * Any invalid manifest or unknown override fails closed; contributions only add effects.
 */
export function resolveRpcEffects(
  model: string,
  method: string,
  trusted: {
    /** Host attests this covers the effective implementation, including installed overrides. */
    readonly effective?: RpcEffectManifest;
    /** Additive contributions can never establish completeness themselves. */
    readonly addons?: readonly RpcEffectManifest[];
  } = {},
): EffectSet {
  if (trusted === null || typeof trusted !== 'object' || Array.isArray(trusted)) return EFFECTS;
  const effective = trusted.effective;
  const addons = trusted.addons === undefined ? [] : trusted.addons;
  if (!effective || !Array.isArray(addons)) return EFFECTS;
  const manifests: readonly RpcEffectManifest[] = [effective, ...addons];
  if (!manifests.every(validManifest)) return EFFECTS;
  if (!effective.declarations.some((item) => item.model === model && item.method === method)) {
    return EFFECTS;
  }
  const declarations = manifests.flatMap((manifest) =>
    manifest.declarations.filter((item) => item.model === model && item.method === method),
  );
  return composeEffects(rpcMinimum(model, method), ...declarations.map((item) => item.effects));
}

export interface HelperEffectDeclaration {
  /** Minimum library behavior; compose with every effective RPC during execution. */
  readonly effects: EffectSet;
  readonly rpc: 'none' | 'dynamic';
}

const helperEffects: Record<string, HelperEffectDeclaration> = Object.create(null);
function declare(paths: readonly string[], effects: EffectSet, rpc: 'none' | 'dynamic'): void {
  const declaration = Object.freeze({ effects: composeEffects(effects), rpc });
  for (const path of paths) helperEffects[path] = declaration;
}

declare(
  [
    'client.search',
    'client.read',
    'client.searchRead',
    'client.searchCount',
    'accounting.discoverCashAccounts',
    'accounting.getCashAccountIds',
    'accounting.traceReconciliation',
    'accounting.resolvePartnerFromMove',
    'accounting.isClosingEntry',
    'accounting.calculateDaysToPay',
    'accounting.getCashBalance',
    'accounting.getPostedMoveLines',
    'attendance.resolveEmployeeId',
    'attendance.getStatus',
    'attendance.list',
    'timesheets.getRunningTimers',
    'timesheets.list',
    'urls.getBaseUrl',
    'urls.getRecordUrl',
    'modules.inspectPrerequisites',
    'modules.listModules',
    'modules.getModuleInfo',
    'modules.isModuleInstalled',
    'properties.scope',
    'properties.getCurrentWriteFormat',
    'properties.scope.refresh',
    'properties.binding.read',
    'cdc.check',
    'cdc.getHistory',
    'cdc.getFeed',
    'introspection.getModels',
    'introspection.getFields',
    'introspection.getModelMetadata',
    'introspection.getFieldAttributes',
  ],
  ['read'],
  'dynamic',
);
declare(
  [
    'client.create',
    'client.write',
    'attendance.clockIn',
    'attendance.clockOut',
    'timesheets.startTimer',
    'timesheets.stopTimer',
    'timesheets.logTime',
    'properties.updateSafely',
    'properties.updateSafelyBatch',
    'properties.binding.patch',
    'properties.binding.patchMany',
    'properties.binding.patchEach',
    'properties.binding.create',
  ],
  ['read', 'mutate'],
  'dynamic',
);
declare(['client.unlink'], ['mutate', 'destructive'], 'dynamic');
declare(['mail.postInternalNote', 'mail.postOpenMessage'], ['mutate', 'external'], 'dynamic');
declare(['urls.getPortalUrl'], ['read', 'mutate', 'disclose'], 'dynamic');
declare(
  ['modules.installModule', 'modules.upgradeModule', 'modules.uninstallModule'],
  ['read', 'mutate', 'destructive', 'external', 'schema'],
  'dynamic',
);
declare(['client.call'], ['unknown'], 'dynamic');
declare(
  [
    'client.getSession',
    'client.getServerInfo',
    'client.setSafetyContext',
    'client.mail',
    'client.modules',
    'client.attendance',
    'client.timesheets',
    'client.accounting',
    'client.urls',
    'client.properties',
    'client.cdc',
    'accounting.isClosingEntryFromLines',
    'modules.catalogRevision',
    'properties.scope.bind',
    'properties.scope.describe',
    'properties.binding.mapping',
    'introspection.clearCache',
    'introspection.clearModelCache',
  ],
  [],
  'none',
);

declare(
  [
    'getModels',
    'setModels',
    'getFields',
    'setFields',
    'getMetadata',
    'setMetadata',
    'getFieldAttributes',
    'setFieldAttributes',
    'clear',
    'clearModel',
  ].map((method) => `introspection.cache.${method}`),
  [],
  'none',
);
declare(
  [
    'mapOdooFieldTypeToTypeScript',
    'modelNameToInterfaceName',
    'generateModelInterface',
    'generateCompleteFile',
    'generateHelperTypes',
    'mapFieldType',
    'getFieldTypeExpression',
    'isWritableField',
    'generateFieldJSDoc',
  ].map((method) => `formatters.${method}`),
  [],
  'none',
);

/** Frozen library minima for the portable client and introspection, versioned by this contract. */
const standaloneAliases: Record<string, string> = {
  discoverCashAccounts: 'accounting.discoverCashAccounts',
  getCashAccountIds: 'accounting.getCashAccountIds',
  traceReconciliation: 'accounting.traceReconciliation',
  resolvePartnerFromMove: 'accounting.resolvePartnerFromMove',
  isClosingEntry: 'accounting.isClosingEntry',
  isClosingEntryFromLines: 'accounting.isClosingEntryFromLines',
  calculateDaysToPay: 'accounting.calculateDaysToPay',
  getCashBalance: 'accounting.getCashBalance',
  getPostedMoveLines: 'accounting.getPostedMoveLines',
  resolveEmployeeId: 'attendance.resolveEmployeeId',
  clockIn: 'attendance.clockIn',
  clockOut: 'attendance.clockOut',
  getStatus: 'attendance.getStatus',
  listAttendances: 'attendance.list',
  startTimer: 'timesheets.startTimer',
  stopTimer: 'timesheets.stopTimer',
  getRunningTimers: 'timesheets.getRunningTimers',
  logTime: 'timesheets.logTime',
  listTimesheets: 'timesheets.list',
  postInternalNote: 'mail.postInternalNote',
  postOpenMessage: 'mail.postOpenMessage',
  getBaseUrl: 'urls.getBaseUrl',
  getRecordUrl: 'urls.getRecordUrl',
  getPortalUrl: 'urls.getPortalUrl',
  inspectModulePrerequisites: 'modules.inspectPrerequisites',
  createPropertiesScope: 'properties.scope',
  updateSafely: 'properties.updateSafely',
  updateSafelyBatch: 'properties.updateSafelyBatch',
  getCurrentWriteFormat: 'properties.getCurrentWriteFormat',
};
for (const [alias, path] of Object.entries(standaloneAliases)) {
  const declaration = helperEffects[path];
  if (declaration) helperEffects[alias] = declaration;
}
declare(['createBoundClient', 'BoundClient', 'Introspector', 'IntrospectionCache'], [], 'none');
declare(
  [
    'AccountingService',
    'AttendanceService',
    'CdcService',
    'MailService',
    'ModuleManager',
    'PropertiesService',
    'TimesheetsService',
    'UrlService',
  ],
  [],
  'none',
);
declare(
  [
    'getPropertyValue',
    'propertiesToWriteFormat',
    'getPropertyDefinition',
    'ensureHtmlBody',
    'inferSafetyLevel',
    'resolveSafetyContext',
    'setDefaultSafetyContext',
    'getDefaultSafetyContext',
  ],
  [],
  'none',
);
for (const [path, declaration] of Object.entries(helperEffects)) {
  if (path.startsWith('formatters.')) helperEffects[path.slice('formatters.'.length)] = declaration;
}
for (const name of ['getPropertyValue', 'propertiesToWriteFormat', 'getPropertyDefinition']) {
  const declaration = helperEffects[name];
  if (declaration) helperEffects[`propertyCodecs.${name}`] = declaration;
}

export const HELPER_EFFECTS: Readonly<Record<string, HelperEffectDeclaration>> =
  Object.freeze(helperEffects);

/** Unlisted helpers are unknown. An empty set denotes a declared local/pure operation. */
export function getHelperEffects(path: string): HelperEffectDeclaration {
  return HELPER_EFFECTS[path] ?? Object.freeze({ effects: EFFECTS, rpc: 'dynamic' });
}
