import assert from 'node:assert/strict';
import { requireResults } from './check-lib.mjs';

assert(
  process.env.QUALIFY19 === undefined || ['true', 'false'].includes(process.env.QUALIFY19),
  'QUALIFY19 must be an explicit boolean',
);
requireResults(JSON.parse(process.env.RESULTS ?? '{}'), process.env.QUALIFY19 === 'true');
