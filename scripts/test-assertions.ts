import assert from 'node:assert/strict';

/** Test fixtures must fail at runtime when an expected row/call is absent. */
export function required<T>(value: T | undefined): T {
  assert(value !== undefined, 'Expected a record or recorded mock call');
  return value;
}
