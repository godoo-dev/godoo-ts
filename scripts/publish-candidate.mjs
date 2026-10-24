import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { require18Proof, requireMainCandidate, run, verifyCandidate } from './check-lib.mjs';
import { publishMissingPackages } from './publish-registry.mjs';

// This entrypoint is only reached by the explicit protected manual promotion job.
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.GODOO_PUBLISH, 'true', 'Explicit publish choice is required');
requireMainCandidate();
const manifest = verifyCandidate(process.env.CANDIDATE_DIR);
require18Proof(process.env.CANDIDATE_DIR, manifest);
const outcomes = await publishMissingPackages(manifest, process.env.CANDIDATE_DIR, {
  publish(pkg) {
    run('npm', [
      'publish',
      resolve(process.env.CANDIDATE_DIR, pkg.file),
      '--ignore-scripts',
      '--access',
      'public',
      '--registry',
      'https://registry.npmjs.org',
      '--provenance',
    ]);
  },
});
console.log(JSON.stringify(outcomes, null, 2));
