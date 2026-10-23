import { requireResults } from './check-lib.mjs';

requireResults(JSON.parse(process.env.RESULTS ?? '{}'));
