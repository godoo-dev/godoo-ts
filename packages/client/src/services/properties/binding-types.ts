import type { OdooCrudClient } from '../../client/types';
import type { PropertiesReadFormat } from '../../types/properties';

/** The structural seam also accepts OAuthProxyClient. */
export type PropertiesClient = Pick<OdooCrudClient, 'call' | 'read' | 'write'>;
export type PropertySelector =
  | { readonly label: string; readonly id?: never }
  | { readonly id: string; readonly label?: never };
export type BoundPropertyKind =
  | 'char'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'selection'
  | 'tags'
  | 'many2one'
  | 'many2many';
export type PropertyDeclaration = PropertySelector &
  (
    | { readonly type: 'char' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime' }
    | { readonly type: 'many2one' | 'many2many'; readonly comodel?: string }
    | {
        readonly type: 'selection' | 'tags';
        readonly options: Readonly<Record<string, PropertySelector>>;
      }
  );
export type PropertiesDeclarations = Readonly<Record<string, PropertyDeclaration>>;
type PropertyValueForKind<D extends PropertyDeclaration, K extends BoundPropertyKind> = K extends
  | 'selection'
  | 'tags'
  ? D extends { options: infer O }
    ? K extends 'tags'
      ? Array<Extract<keyof O, string>>
      : Extract<keyof O, string>
    : never
  : K extends 'many2many'
    ? number[]
    : K extends 'integer' | 'float' | 'many2one'
      ? number
      : K extends 'boolean'
        ? boolean
        : string;
// Distribute both declaration unions and unions within a declaration's type.
export type BoundPropertyValue<D extends PropertyDeclaration> = D extends PropertyDeclaration
  ? PropertyValueForKind<D, D['type']> | null
  : never;
export type BoundProperties<D extends PropertiesDeclarations> = {
  -readonly [K in keyof D]: BoundPropertyValue<D[K]>;
};
export type PropertiesPatch<D extends PropertiesDeclarations> = Partial<BoundProperties<D>>;
export interface PropertiesParent {
  model: string;
  field: string;
  /** Child many2one field used to enforce membership, including with overrides. */
  relation: string;
}
export interface PropertiesScopeOptions {
  parentId: number;
  context?: Record<string, unknown>;
  parent?: PropertiesParent;
  /** Maximum concurrent writes, default 4. No automatic write retries. */
  concurrency?: number;
}
export interface PropertiesDescription {
  model: string;
  field: string;
  parentId: number;
  parent: PropertiesParent;
  context: Record<string, unknown>;
  /** Unabridged fields_get metadata and parent definitions for discovery. */
  metadata: Record<string, unknown>;
  definitions: Record<string, unknown>[];
}
export interface ResolvedProperty {
  id: string;
  type: BoundPropertyKind;
  comodel?: string;
  /** Application option alias -> technical option ID. */
  options?: Record<string, string>;
}
export type PropertiesMapping<D extends PropertiesDeclarations> = {
  -readonly [K in keyof D]: ResolvedProperty;
};
export interface BoundPropertiesRecord<D extends PropertiesDeclarations> {
  id: number;
  properties: BoundProperties<D>;
  raw: PropertiesReadFormat;
}
export type PropertiesWriteReceipt =
  | { id: number; status: 'acknowledged' }
  | { id: number; status: 'failed' | 'unknown'; error: unknown };
export interface PropertiesChange<D extends PropertiesDeclarations> {
  id: number;
  changes: PropertiesPatch<D>;
}
export interface PropertiesBinding<D extends PropertiesDeclarations> {
  mapping(): PropertiesMapping<D>;
  read(ids: readonly number[]): Promise<BoundPropertiesRecord<D>[]>;
  patch(id: number, changes: PropertiesPatch<D>): Promise<PropertiesWriteReceipt>;
  patchMany(ids: readonly number[], changes: PropertiesPatch<D>): Promise<PropertiesWriteReceipt[]>;
  patchEach(changes: readonly PropertiesChange<D>[]): Promise<PropertiesWriteReceipt[]>;
}
export interface PropertiesScope {
  describe(): PropertiesDescription;
  /** Updates discovery only; existing bindings retain their resolved IDs. */
  refresh(): Promise<PropertiesDescription>;
  bind<const D extends PropertiesDeclarations>(declarations: D): PropertiesBinding<D>;
}
