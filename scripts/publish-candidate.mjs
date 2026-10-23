import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { require18Proof, requireMainCandidate, run, verifyCandidate } from './check-lib.mjs';

// This entrypoint is only reached by the explicit protected manual promotion job.
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.GODOO_PUBLISH, 'true', 'Explicit publish choice is required');
requireMainCandidate();
const manifest = verifyCandidate(process.env.CANDIDATE_DIR);
require18Proof(process.env.CANDIDATE_DIR, manifest);
for (const pkg of manifest.packages) {
  run('npm', [
    'publish',
    resolve(process.env.CANDIDATE_DIR, pkg.file),
    '--ignore-scripts',
    '--access',
    'public',
    '--provenance',
  ]);
}
