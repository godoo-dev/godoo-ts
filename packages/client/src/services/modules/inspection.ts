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

type Edge = { from: string; to: string };

/** Walk one DFS tree from `root`, recording back edges into `result`. */
function walkCycles(
  root: string,
  byName: Map<string, ModulePrerequisite>,
  visited: Set<string>,
  result: Edge[],
): void {
  const active = new Set<string>([root]);
  const stack = [{ name: root, index: 0 }];
  visited.add(root);
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

function cycleEdges(modules: ModulePrerequisite[]): Edge[] {
  const byName = new Map(modules.map((module) => [module.name, module]));
  const visited = new Set<string>();
  const result: Edge[] = [];
  // Iterative DFS also handles deep chains without overflowing the JS call stack.
  for (const root of modules) {
    if (visited.has(root.name)) continue;
    walkCycles(root.name, byName, visited, result);
  }
  return result;
}

interface Relation {
  field: string;
  relatedModel: string;
}

/** Map an observable metadata restriction to its diagnostic code; undefined means propagate. */
function metadataDiagnosticCode(
  cause: unknown,
  model: string,
): { code: ModuleInspectionDiagnostic['code']; cause: OdooRpcError } | undefined {
  if (cause instanceof OdooAccessError) return { code: 'access-denied', cause };
  if (cause instanceof OdooMissingError) return { code: 'metadata-incomplete', cause };
  if (
    cause instanceof OdooRpcError &&
    cause.data?.name === 'builtins.KeyError' &&
    Array.isArray(cause.data.arguments) &&
    cause.data.arguments[0] === model
  )
    return { code: 'model-unavailable', cause };
  return undefined;
}

function metadataMessage(
  model: string,
  module: string | undefined,
  relation: Relation | undefined,
  causeMessage: string,
): string {
  const relationText = relation ? `.${relation.field} (relation to ${relation.relatedModel})` : '';
  const moduleText = module ? ` for '${module}'` : '';
  return `Cannot inspect ${model}${relationText}${moduleText}: ${causeMessage}`;
}

function isValidModuleRow(row: Row | undefined, name: string): row is Row & { id: number } {
  return (
    !!row &&
    row.name === name &&
    typeof row.id === 'number' &&
    Number.isInteger(row.id) &&
    row.id > 0
  );
}

function isValidDependencyIds(ids: unknown): ids is number[] {
  return (
    Array.isArray(ids) &&
    !ids.some((id) => typeof id !== 'number' || !Number.isInteger(id) || id <= 0)
  );
}

function isExpectedDependencySchema(dependencySchema: Schema): boolean {
  return (
    dependencySchema.name?.type === 'char' &&
    dependencySchema.module_id?.type === 'many2one' &&
    dependencySchema.module_id.relation === MODULE
  );
}

const STATE_DIAGNOSTICS: Partial<
  Record<ModuleInspectionStatus, ModuleInspectionDiagnostic['code']>
> = {
  unknown: 'unknown-state',
  transitional: 'transitional-module',
  uninstallable: 'uninstallable-module',
};

function newNode(name: string): ModulePrerequisite {
  return {
    name,
    id: null,
    status: 'unknown',
    state: null,
    dependencies: null,
    sourceAvailability: 'unknown',
    externalPrerequisites: 'unknown',
  };
}

class ModuleInspector {
  readonly diagnostics: ModuleInspectionDiagnostic[] = [];
  readonly modules: ModulePrerequisite[] = [];
  private readonly seen = new Set<string>();
  private readonly pending: string[];
  private dependencySchema: Schema | null | undefined;
  private canReadState = false;
  private canReadEdges = false;

  constructor(
    private readonly client: ModuleInspectionClient,
    private readonly kwargs: { context?: Record<string, unknown> },
    requested: readonly string[],
  ) {
    this.pending = [...requested];
  }

  private async metadata<T>(
    model: string,
    read: () => Promise<T>,
    module?: string,
    relation?: Relation,
  ): Promise<T | null> {
    try {
      return await read();
    } catch (error) {
      const classified = metadataDiagnosticCode(error, model);
      if (!classified) throw error;
      const { code, cause } = classified;
      this.diagnostics.push({
        code,
        model,
        module,
        ...relation,
        cause,
        message: metadataMessage(model, module, relation, cause.message),
      });
      return null;
    }
  }

  private async schema(model: string, fields: string[]): Promise<Schema | null> {
    return this.metadata(model, async () => {
      const result = await this.client.call<Schema>(model, 'fields_get', [fields], {
        ...this.kwargs,
        attributes: ['type', 'relation'],
      });
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new OdooRpcError(`Invalid fields_get metadata returned for ${model}`);
      }
      return result;
    });
  }

  private async readRows(
    model: string,
    domain: Domain,
    fields: string[],
    module: string,
    relation?: Relation,
  ): Promise<Row[] | null> {
    return this.metadata(
      model,
      async () => {
        const result = await this.client.searchRead<Row>(model, domain, {
          ...this.kwargs,
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

  async run(): Promise<void> {
    const moduleSchema = await this.schema(MODULE, ['name', 'state', 'dependencies_id']);
    this.canReadState =
      moduleSchema?.name?.type === 'char' && moduleSchema.state?.type === 'selection';
    this.canReadEdges =
      moduleSchema?.dependencies_id?.type === 'one2many' &&
      moduleSchema.dependencies_id.relation === DEPENDENCY;
    if (moduleSchema && (!this.canReadState || !this.canReadEdges))
      this.diagnostics.push({
        code: 'schema-unavailable',
        model: MODULE,
        message:
          'Expected Odoo 17 name/state/dependencies_id schema is unavailable or restricted; no support is inferred from server version.',
      });
    while (this.pending.length) {
      const name = this.pending.shift();
      if (name === undefined) break;
      if (this.seen.has(name)) continue;
      this.seen.add(name);
      await this.inspectModule(name);
    }
  }

  private async inspectModule(name: string): Promise<void> {
    const node = newNode(name);
    this.modules.push(node);
    if (!this.canReadState) {
      if (this.diagnostics.some((d) => d.model === MODULE && d.code === 'access-denied'))
        node.status = 'inaccessible';
      return;
    }
    const id = await this.readState(node);
    if (id === null || !this.canReadEdges) return;
    const ids = await this.readDependencyIds(node, id);
    if (ids === null) return;
    if (!ids.length) {
      node.dependencies = [];
      return;
    }
    if (!(await this.loadDependencySchema())) return;
    await this.expandDependencies(node, id, ids);
  }

  /** Read the addon's registered state; returns its id when dependency expansion may follow. */
  private async readState(node: ModulePrerequisite): Promise<number | null> {
    const name = node.name;
    const diagnosticStart = this.diagnostics.length;
    const rows = await this.readRows(MODULE, [['name', '=', name]], ['id', 'name', 'state'], name);
    if (rows === null) {
      if (this.diagnostics.slice(diagnosticStart).some((d) => d.code === 'access-denied'))
        node.status = 'inaccessible';
      return null;
    }
    if (!rows.length) {
      node.status = 'missing';
      this.diagnostics.push({
        code: 'missing-module',
        model: MODULE,
        module: name,
        message: `No visible registered addon '${name}'. Catalog freshness, record-rule visibility and server source availability are unknown.`,
      });
      return null;
    }
    if (rows.length !== 1) {
      this.diagnostics.push({
        code: 'duplicate-module',
        model: MODULE,
        module: name,
        message: `Multiple registered addons named '${name}'; refusing to choose one.`,
      });
      return null;
    }
    const row = rows[0];
    if (!isValidModuleRow(row, name)) {
      throw new OdooRpcError(`Invalid addon metadata returned for '${name}'`);
    }
    node.id = row.id;
    node.state = typeof row.state === 'string' ? row.state : null;
    node.status = statusFor(row.state);
    const code = STATE_DIAGNOSTICS[node.status];
    if (code) {
      this.diagnostics.push({
        code,
        model: MODULE,
        module: name,
        message: `Addon '${name}' reports state ${JSON.stringify(row.state)}; this does not establish source or external prerequisite availability.`,
      });
    }
    return row.id;
  }

  private async readDependencyIds(node: ModulePrerequisite, id: number): Promise<number[] | null> {
    const name = node.name;
    // Odoo reads a One2many via the comodel's search/ACL checks. Keep that
    // expansion separate so its denial cannot erase independently readable state.
    const relation = { field: 'dependencies_id', relatedModel: DEPENDENCY };
    const dependencyRows = await this.readRows(
      MODULE,
      [['id', '=', id]],
      ['id', 'dependencies_id'],
      name,
      relation,
    );
    if (dependencyRows === null) return null;
    const dependencyRow = dependencyRows[0];
    if (dependencyRows.length !== 1 || dependencyRow?.id !== id) {
      this.diagnostics.push({
        code: 'metadata-incomplete',
        model: MODULE,
        module: name,
        ...relation,
        message: `Addon '${name}' changed or became hidden while reading dependency IDs; its observed state is retained.`,
      });
      return null;
    }
    const ids = dependencyRow.dependencies_id;
    if (!isValidDependencyIds(ids)) {
      this.diagnostics.push({
        code: 'metadata-incomplete',
        model: MODULE,
        module: name,
        ...relation,
        message: `Addon '${name}' did not expose valid dependency IDs.`,
      });
      return null;
    }
    return ids;
  }

  /** Probe the dependency schema once; null means edges cannot be read. */
  private async loadDependencySchema(): Promise<Schema | null> {
    if (this.dependencySchema !== undefined) return this.dependencySchema;
    const dependencySchema = await this.schema(DEPENDENCY, ['name', 'module_id']);
    if (dependencySchema && !isExpectedDependencySchema(dependencySchema)) {
      this.diagnostics.push({
        code: 'schema-unavailable',
        model: DEPENDENCY,
        message: 'Expected Odoo 17 dependency name/module_id schema is unavailable or restricted.',
      });
      this.dependencySchema = null;
      return null;
    }
    this.dependencySchema = dependencySchema;
    return dependencySchema;
  }

  private async expandDependencies(
    node: ModulePrerequisite,
    id: number,
    ids: number[],
  ): Promise<void> {
    const name = node.name;
    const edges = await this.readRows(
      DEPENDENCY,
      [['id', 'in', ids]],
      ['id', 'name', 'module_id'],
      name,
    );
    if (edges === null) return;
    const expected = new Set<unknown>(ids);
    const actual = new Set(edges.map((edge) => edge.id));
    const isValidEdge = (edge: Row): boolean =>
      expected.has(edge.id) &&
      typeof edge.name === 'string' &&
      edge.name.length > 0 &&
      Array.isArray(edge.module_id) &&
      edge.module_id[0] === id;
    const valid =
      actual.size === expected.size && edges.length === expected.size && edges.every(isValidEdge);
    if (!valid) {
      this.diagnostics.push({
        code: 'metadata-incomplete',
        model: DEPENDENCY,
        module: name,
        message: `Dependency rows for '${name}' are hidden, changed or malformed; closure is incomplete.`,
      });
    }
    // Continue through visible valid names even when the complete list is unavailable.
    const names = sortedUnique(edges.filter(isValidEdge).map((edge) => edge.name as string));
    if (valid) node.dependencies = names;
    this.pending.push(...names.filter((dependency) => !this.seen.has(dependency)));
    this.pending.sort();
  }
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
  if (!requested.length)
    return { requested, modules: [], diagnostics: [], closureComplete: true, cycleEdges: [] };
  const kwargs = options.context === undefined ? {} : { context: options.context };
  const inspector = new ModuleInspector(client, kwargs, requested);
  await inspector.run();
  const { modules, diagnostics } = inspector;
  modules.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requested,
    modules,
    diagnostics,
    closureComplete: modules.every((node) => node.dependencies !== null),
    cycleEdges: cycleEdges(modules),
  };
}
