/**
 * Resolver: converts raw mail.tracking.value columns into TypedValue pairs.
 *
 * ## Resolver contract
 *
 * | ttype              | column(s)                                    | notes                              |
 * |--------------------|----------------------------------------------|------------------------------------|
 * | char / binary      | old/new_value_char                           |                                    |
 * | text / html        | old/new_value_text (fallback: _char)         |                                    |
 * | integer            | old/new_value_integer                        |                                    |
 * | boolean            | old/new_value_integer                        | 0 → false, 1 → true               |
 * | float              | old/new_value_float                          |                                    |
 * | monetary           | old/new_value_float + currency_id            | currency carries [id, code]        |
 * | datetime           | old/new_value_datetime                       | ISO 'YYYY-MM-DD HH:MM:SS'          |
 * | date               | old/new_value_datetime                       | strip time component               |
 * | selection          | old/new_value_char                           | translated label; isTranslated:true|
 * | many2one           | old/new_value_integer (id) + _char (name)    | id in .id                          |
 * | many2many/one2many | not tracked by Odoo                          | raw: null                          |
 * | unknown/other      | —                                            | raw: null                          |
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_tracking_value.py
 */

import type { OdooFieldType, TypedValue } from './types';

/** Raw row from mail.tracking.value as returned by Odoo RPC */
export interface RawTrackingRow {
  id: number;
  field_id: [number, string] | false;
  /** field_info is set when the field was deleted; field_id is false in that case */
  field_info: { name: string; desc: string; type: string; sequence?: number } | false;
  old_value_char: string | false;
  new_value_char: string | false;
  old_value_text: string | false;
  new_value_text: string | false;
  old_value_integer: number | false;
  new_value_integer: number | false;
  old_value_float: number | false;
  new_value_float: number | false;
  old_value_datetime: string | false;
  new_value_datetime: string | false;
  currency_id: [number, string] | false;
  mail_message_id: [number, string];
  create_date: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v: string | false): string | null {
  return v === false || v === '' ? null : v;
}

function num(v: number | false): number | null {
  return v === false ? null : v;
}

function pair(o: TypedValue, n: TypedValue): { old: TypedValue; new: TypedValue } {
  return { old: o, new: n };
}

function plain(v: string | null): TypedValue {
  return { raw: v, display: v };
}

function numeric(v: number | null): TypedValue {
  return { raw: v, display: v !== null ? String(v) : null };
}

function toBool(v: number | false): boolean | null {
  return v === false ? null : v !== 0;
}

function boolean(v: boolean | null): TypedValue {
  return { raw: v, display: v !== null ? (v ? 'Yes' : 'No') : null };
}

function monetary(v: number | null, currency: [number, string] | undefined): TypedValue {
  return { raw: v, display: v !== null ? String(v) : null, ...(currency && { currency }) };
}

function toDate(s: string | false): string | null {
  const v = str(s);
  return v ? (v.split(' ')[0] ?? null) : null;
}

function many2one(id: number | null, name: string | null): TypedValue {
  return { raw: id, display: name, ...(id !== null && { id }) };
}

function selection(v: string | null): TypedValue {
  return { raw: v, display: v, isTranslated: true };
}

type Resolver = (row: RawTrackingRow) => { old: TypedValue; new: TypedValue };

const charResolver: Resolver = (row) =>
  pair(plain(str(row.old_value_char)), plain(str(row.new_value_char)));

// Odoo uses old_value_text for long strings, falls back to old_value_char
const textResolver: Resolver = (row) =>
  pair(
    plain(str(row.old_value_text) ?? str(row.old_value_char)),
    plain(str(row.new_value_text) ?? str(row.new_value_char)),
  );

const RESOLVERS: Partial<Record<OdooFieldType, Resolver>> = {
  char: charResolver,
  binary: charResolver,
  text: textResolver,
  html: textResolver,
  integer: (row) => pair(numeric(num(row.old_value_integer)), numeric(num(row.new_value_integer))),
  boolean: (row) =>
    pair(boolean(toBool(row.old_value_integer)), boolean(toBool(row.new_value_integer))),
  float: (row) => pair(numeric(num(row.old_value_float)), numeric(num(row.new_value_float))),
  monetary: (row) => {
    const currency = row.currency_id === false ? undefined : row.currency_id;
    return pair(
      monetary(num(row.old_value_float), currency),
      monetary(num(row.new_value_float), currency),
    );
  },
  datetime: (row) => pair(plain(str(row.old_value_datetime)), plain(str(row.new_value_datetime))),
  date: (row) => pair(plain(toDate(row.old_value_datetime)), plain(toDate(row.new_value_datetime))),
  selection: (row) => pair(selection(str(row.old_value_char)), selection(str(row.new_value_char))),
  many2one: (row) =>
    pair(
      many2one(num(row.old_value_integer), str(row.old_value_char)),
      many2one(num(row.new_value_integer), str(row.new_value_char)),
    ),
};

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve raw tracking value columns into typed old/new pair.
 *
 * Never throws — unknown ttypes return `{ raw: null, display: null }`.
 */
export function resolveValues(
  row: RawTrackingRow,
  ttype: OdooFieldType,
): { old: TypedValue; new: TypedValue } {
  const resolver = Object.hasOwn(RESOLVERS, ttype) ? RESOLVERS[ttype] : undefined;
  if (resolver) return resolver(row);
  return {
    old: { raw: null, display: null },
    new: { raw: null, display: null },
  };
}
