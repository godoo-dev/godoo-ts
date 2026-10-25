import type { OdooCrudClient } from '../../client/types';
import type { Domain } from '../../rpc/types';
import { OdooAccessError, OdooMissingError, OdooRpcError } from '../../types/errors';

/** Only these read operations are needed; also usable with OAuthProxyClient. */
export type ModuleInspectionClient = Pick<OdooCrudClient, 'call' | 'searchRead'>;

export interface ModuleInspectionOptions {
  context?: Record<string, unknown>;
}

export type ModuleInspectionStatus =
  | 'installed'
  | 'uninstalled'
  | 'missing'
  | 'uninstallable'
  | 'transitional'
  | 'unknown'
  | 'inaccessible';

export interface ModulePrerequisite {
  name: string;
  id: number | null;
  status: ModuleInspectionStatus;
  /** Exact server state, including unfamiliar states. */
  state: string | null;
  /** null means dependency metadata is incomplete, not an empty dependency list. */
  dependencies: string[] | null;
  sourceAvailability: 'unknown';
  externalPrerequisites: 'unknown';
}

export interface ModuleInspectionDiagnostic {
  code:
    | 'access-denied'
    | 'model-unavailable'
    | 'schema-unavailable'
    | 'metadata-incomplete'
    | 'missing-module'
    | 'duplicate-module'
    | 'uninstallable-module'
    | 'transitional-module'
    | 'unknown-state';
  model: string;
  module?: string;
  /** Relation field being expanded, if the read failed before returning its IDs. */
  field?: string;
  /** Related model, without guessing which model's ACL caused a relation denial. */
  relatedModel?: string;
  message: string;
  /** Original structured error when a metadata read was refused/unavailable. */
  cause?: OdooRpcError;
}

export interface ModulePrerequisiteInspection {
  requested: string[];
  /** Sorted by technical name; includes roots and visible transitive dependencies. */
  modules: ModulePrerequisite[];
  diagnostics: ModuleInspectionDiagnostic[];
  /** Completeness of visible registered edges only, never proof of installability. */
  closureComplete: boolean;
  /** Deterministic DFS back edges; not a resource ordering or installation plan. */
  cycleEdges: { from: string; to: string }[];
}

const MODULE = 'ir.module.module';
const DEPENDENCY = 'ir.module.module.dependency';
type Row = Record<string, unknown>;
type Schema = Record<string, { type?: string; relation?: string }>;

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function statusFor(state: unknown): ModuleInspectionStatus {
  if (state === 'installed' || state === 'uninstalled' || state === 'uninstallable') return state;
  if (state === 'to install' || state === 'to upgrade' || state === 'to remove')
    return 'transitional';
  return 'unknown';
}

function cycleEdges(modules: ModulePrerequisite[]): { from: string; to: string }[] {
  const byName = new Map(modules.map((module) => [module.name, module]));
  const visited = new Set<string>();
  const active = new Set<string>();
  const result: { from: string; to: string }[] = [];
  // Iterative DFS also handles deep chains without overflowing the JS call stack.
  for (const root of modules) {
    if (visited.has(root.name)) continue;
    const stack = [{ name: root.name, index: 0 }];
    visited.add(root.name);
    active.add(root.name);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      const next = byName.get(frame.name)?.dependencies?.[frame.index++];
      if (next === undefined) {
        active.delete(frame.name);
        stack.pop();
      } else if (active.has(next)) {
        result.push({ from: frame.name, to: next });
      } else if (!visited.has(next)) {
        visited.add(next);
        active.add(next);
        stack.push({ name: next, index: 0 });
      }
    }
  }
  return result;
}

/**
 * Inspect Odoo's registered addon state and dependency closure using only
 * fields_get/search_read. Designed against Odoo 17 and schema-probed on each run.
 * No refresh, lifecycle methods, manifest helpers or server actions are invoked.
 * Empty searches mean no visible catalog entry; record rules can hide records.
 * Filesystem addon sources, catalog freshness and Python/system prerequisites
 * cannot be established here. Auth, network, safety and unexpected RPC errors
 * propagate unchanged; observable metadata restrictions retain their causes.
 */
export async function inspectModulePrerequisites(
  client: ModuleInspectionClient,
  moduleNames: readonly string[],
  options: ModuleInspectionOptions = {},
): Promise<ModulePrerequisiteInspection> {
  if (moduleNames.some((name) => typeof name !== 'string' || !name || name.trim() !== name)) {
    throw new TypeError('Module names must be nonempty technical names without surrounding spaces');
  }
  const requested = sortedUnique(moduleNames);
  const diagnostics: ModuleInspectionDiagnostic[] = [];
  const modules: ModulePrerequisite[] = [];
  const kwargs = options.context === undefined ? {} : { context: options.context };

  async function metadata<T>(
    model: string,
    read: () => Promise<T>,
    module?: string,
    relation?: { field: string; relatedModel: string },
  ): Promise<T | null> {
    try {
      return await read();
    } catch (cause) {
      let code: ModuleInspectionDiagnostic['code'];
      if (cause instanceof OdooAccessError) code = 'access-denied';
      else if (cause instanceof OdooMissingError) code = 'metadata-incomplete';
      else if (
        cause instanceof OdooRpcError &&
        cause.data?.name === 'builtins.KeyError' &&
        Array.isArray(cause.data.arguments) &&
        cause.data.arguments[0] === model
      )
        code = 'model-unavailable';
      else throw cause;
      diagnostics.push({
        code,
        model,
        module,
        ...relation,
        cause,
        message: `Cannot inspect ${model}${relation ? `.${relation.field} (relation to ${relation.relatedModel})` : ''}${module ? ` for '${module}'` : ''}: ${cause.message}`,
      });
      return null;
    }
  }

  async function schema(model: string, fields: string[]): Promise<Schema | null> {
    return metadata(model, async () => {
      const result = await client.call<Schema>(model, 'fields_get', [fields], {
        ...kwargs,
        attributes: ['type', 'relation'],
      });
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new OdooRpcError(`Invalid fields_get metadata returned for ${model}`);
      }
      return result;
    });
  }

  async function readRows(
    model: string,
    domain: Domain,
    fields: string[],
    module: string,
    relation?: { field: string; relatedModel: string },
  ): Promise<Row[] | null> {
    return metadata(
      model,
      async () => {
        const result = await client.searchRead<Row>(model, domain, {
          ...kwargs,
          fields,
          order: 'id',
        });
        if (
          !Array.isArray(result) ||
          result.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
        ) {
          throw new OdooRpcError(
            `Invalid search_read metadata returned for ${model} while inspecting '${module}'`,
          );
        }
        return result;
      },
      module,
      relation,
    );
  }

  if (!requested.length)
    return { requested, modules, diagnostics, closureComplete: true, cycleEdges: [] };
  const moduleSchema = await schema(MODULE, ['name', 'state', 'dependencies_id']);
  const canReadState =
    moduleSchema?.name?.type === 'char' && moduleSchema.state?.type === 'selection';
  const canReadEdges =
    moduleSchema?.dependencies_id?.type === 'one2many' &&
    moduleSchema.dependencies_id.relation === DEPENDENCY;
  if (moduleSchema && (!canReadState || !canReadEdges))
    diagnostics.push({
      code: 'schema-unavailable',
      model: MODULE,
      message:
        'Expected Odoo 17 name/state/dependencies_id schema is unavailable or restricted; no support is inferred from server version.',
    });
  let dependencySchema: Schema | null | undefined;
  const seen = new Set<string>();
  const pending = [...requested];
  while (pending.length) {
    const name = pending.shift();
    if (name === undefined) break;
    if (seen.has(name)) continue;
    seen.add(name);
    const node: ModulePrerequisite = {
      name,
      id: null,
      status: 'unknown',
      state: null,
      dependencies: null,
      sourceAvailability: 'unknown',
      externalPrerequisites: 'unknown',
    };
    modules.push(node);
    if (!canReadState) {
      if (diagnostics.some((d) => d.model === MODULE && d.code === 'access-denied'))
        node.status = 'inaccessible';
      continue;
    }
    const diagnosticStart = diagnostics.length;
    const rows = await readRows(MODULE, [['name', '=', name]], ['id', 'name', 'state'], name);
    if (rows === null) {
      if (diagnostics.slice(diagnosticStart).some((d) => d.code === 'access-denied'))
        node.status = 'inaccessible';
      continue;
    }
    if (!rows.length) {
      node.status = 'missing';
      diagnostics.push({
        code: 'missing-module',
        model: MODULE,
        module: name,
        message: `No visible registered addon '${name}'. Catalog freshness, record-rule visibility and server source availability are unknown.`,
      });
      continue;
    }
    if (rows.length !== 1) {
      diagnostics.push({
        code: 'duplicate-module',
        model: MODULE,
        module: name,
        message: `Multiple registered addons named '${name}'; refusing to choose one.`,
      });
      continue;
    }
    const row = rows[0];
    if (
      !row ||
      row.name !== name ||
      typeof row.id !== 'number' ||
      !Number.isInteger(row.id) ||
      row.id <= 0
    ) {
      throw new OdooRpcError(`Invalid addon metadata returned for '${name}'`);
    }
    node.id = row.id;
    node.state = typeof row.state === 'string' ? row.state : null;
    node.status = statusFor(row.state);
    if (
      node.status === 'unknown' ||
      node.status === 'transitional' ||
      node.status === 'uninstallable'
    ) {
      const code =
        node.status === 'unknown'
          ? 'unknown-state'
          : node.status === 'transitional'
            ? 'transitional-module'
            : 'uninstallable-module';
      diagnostics.push({
        code,
        model: MODULE,
        module: name,
        message: `Addon '${name}' reports state ${JSON.stringify(row.state)}; this does not establish source or external prerequisite availability.`,
      });
    }
    if (!canReadEdges) continue;
    // Odoo reads a One2many via the comodel's search/ACL checks. Keep that
    // expansion separate so its denial cannot erase independently readable state.
    const relation = { field: 'dependencies_id', relatedModel: DEPENDENCY };
    const dependencyRows = await readRows(
      MODULE,
      [['id', '=', node.id]],
      ['id', 'dependencies_id'],
      name,
      relation,
    );
    if (dependencyRows === null) continue;
    const dependencyRow = dependencyRows[0];
    if (dependencyRows.length !== 1 || dependencyRow?.id !== node.id) {
      diagnostics.push({
        code: 'metadata-incomplete',
        model: MODULE,
        module: name,
        ...relation,
        message: `Addon '${name}' changed or became hidden while reading dependency IDs; its observed state is retained.`,
      });
      continue;
    }
    const ids = dependencyRow.dependencies_id;
    if (
      !Array.isArray(ids) ||
      ids.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id <= 0)
    ) {
      diagnostics.push({
        code: 'metadata-incomplete',
        model: MODULE,
        module: name,
        ...relation,
        message: `Addon '${name}' did not expose valid dependency IDs.`,
      });
      continue;
    }
    if (!ids.length) {
      node.dependencies = [];
      continue;
    }
    if (dependencySchema === undefined) {
      dependencySchema = await schema(DEPENDENCY, ['name', 'module_id']);
      if (
        dependencySchema &&
        (dependencySchema.name?.type !== 'char' ||
          dependencySchema.module_id?.type !== 'many2one' ||
          dependencySchema.module_id.relation !== MODULE)
      ) {
        diagnostics.push({
          code: 'schema-unavailable',
          model: DEPENDENCY,
          message:
            'Expected Odoo 17 dependency name/module_id schema is unavailable or restricted.',
        });
        dependencySchema = null;
      }
    }
    if (!dependencySchema) continue;
    const edges = await readRows(
      DEPENDENCY,
      [['id', 'in', ids]],
      ['id', 'name', 'module_id'],
      name,
    );
    if (edges === null) continue;
    const expected = new Set(ids);
    const actual = new Set(edges.map((edge) => edge.id));
    const valid =
      actual.size === expected.size &&
      edges.length === expected.size &&
      edges.every(
        (edge) =>
          expected.has(edge.id) &&
          typeof edge.name === 'string' &&
          edge.name.length > 0 &&
          Array.isArray(edge.module_id) &&
          edge.module_id[0] === node.id,
      );
    if (!valid) {
      diagnostics.push({
        code: 'metadata-incomplete',
        model: DEPENDENCY,
        module: name,
        message: `Dependency rows for '${name}' are hidden, changed or malformed; closure is incomplete.`,
      });
    }
    // Continue through visible valid names even when the complete list is unavailable.
    const names = sortedUnique(
      edges
        .filter(
          (edge) =>
            expected.has(edge.id) &&
            typeof edge.name === 'string' &&
            edge.name.length > 0 &&
            Array.isArray(edge.module_id) &&
            edge.module_id[0] === node.id,
        )
        .map((edge) => edge.name as string),
    );
    if (valid) node.dependencies = names;
    pending.push(...names.filter((dependency) => !seen.has(dependency)));
    pending.sort();
  }
  modules.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requested,
    modules,
    diagnostics,
    closureComplete: modules.every((node) => node.dependencies !== null),
    cycleEdges: cycleEdges(modules),
  };
}
