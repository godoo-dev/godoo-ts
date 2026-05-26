/**
 * Type definitions for JSON-RPC protocol and Odoo search domains.
 */

/**
 * A single clause inside an Odoo search domain.
 *
 * Concrete record clauses are `[field, operator, value]` tuples (e.g.
 * `['name', '=', 'Alice']`). Boolean operators are single-character strings
 * — `'&'` (AND, default), `'|'` (OR), and `'!'` (NOT) — that combine the
 * adjacent clauses in Polish-notation order.
 */
export type DomainClause = [string, string, unknown] | '&' | '|' | '!';

/**
 * Odoo search domain — an ordered array of {@link DomainClause}s.
 *
 * The empty array `[]` is the implicit "match all" domain.
 */
export type Domain = DomainClause[];

/**
 * One positional argument for an Odoo `execute_kw` call.
 *
 * Odoo accepts heterogeneous JSON values; consumers must narrow at the call
 * site (e.g. `args[0] as number`).
 */
export type RpcArg = unknown;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: number | string;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number | string;
}

export interface OdooSessionInfo {
  uid: number;
  session_id: string;
  db: string;
}
