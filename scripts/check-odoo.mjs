import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  output,
  outside,
  packages,
  readJson,
  require18Proof,
  requirePackageProof,
  root,
  run,
  sha256,
  verifyCandidate,
  writeJson,
} from './check-lib.mjs';

const major = Number(process.argv[2] ?? 18);
assert(
  major === 18 || major === 19,
  'Verification supports18, or manual19 after18;17 is rejected before provisioning',
);
if (process.env.ODOO_VERSION)
  assert.equal(
    Number.parseInt(process.env.ODOO_VERSION, 10),
    major,
    'ODOO_VERSION conflicts with requested verification major',
  );
const listOnly = process.argv.includes('--list');
// HQ may schedule these disjoint Odoo 18 suites in parallel. The default still
// qualifies the complete candidate, including the installed consumer.
const suitePackages = {
  client: 'client',
  testcontainers: 'testcontainers',
  'introspection-consumer': 'introspection',
};
assert.deepEqual(Object.values(suitePackages).sort(), [...packages].sort(), 'Suite coverage drift');
const suiteIndex = process.argv.indexOf('--suite');
const suite = suiteIndex === -1 ? null : process.argv[suiteIndex + 1];
assert(suite === null || Object.hasOwn(suitePackages, suite), 'Unknown or missing Odoo suite');
assert(suite === null || major === 18, 'Suite selection is only supported for Odoo 18');
const selectedPackages = suite === null ? packages : [suitePackages[suite]];
const dir = process.env.CANDIDATE_DIR ? outside(process.env.CANDIDATE_DIR) : null;
if (!listOnly) {
  assert(dir, 'CANDIDATE_DIR must identify the packed and package-tested candidate');
  const manifest = verifyCandidate(dir);
  if (major === 19) require18Proof(dir, manifest);
  requirePackageProof(dir, manifest);
  run('docker', ['info'], { stdio: 'pipe', timeout: 30_000 });
}
const selections = {};
for (const name of selectedPackages) {
  const cwd = resolve(root, 'packages', name);
  const selected = JSON.parse(
    output(
      'pnpm',
      // Vitest 5 defaults to static parsing, which can mistake helper calls for
      // tests. Collect by evaluating the files, just as execution does.
      [
        'exec',
        'vitest',
        'list',
        '--config',
        'vitest.integration.config.ts',
        '--json',
        '--staticParse=false',
      ],
      { cwd, env: { ...process.env, GODOO_INTEGRATION_LIST: 'true' } },
    ),
  );
  assert(selected.length > 0, `${name}: empty integration collection`);
  const expected = readdirSync(resolve(cwd, 'tests'))
    .filter((f) => f.endsWith('.integration.test.ts'))
    .sort();
  const actual = [...new Set(selected.map((t) => t.file.split('/').at(-1)))].sort();
  assert.deepEqual(actual, expected, `${name}: integration file omitted`);
  selections[name] = selected;
  if (!listOnly) {
    writeJson(resolve(dir, `${name}-odoo${major}-collection.json`), selected);
    const report = resolve(dir, `${name}-odoo${major}-tests.json`);
    run(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.integration.config.ts',
        '--reporter=default',
        '--reporter=json',
        `--outputFile=${report}`,
      ],
      {
        cwd,
        env: {
          ...process.env,
          GODOO_INTEGRATION_LIST: 'false',
          ODOO_VERSION: `${major}.0`,
          TESTCONTAINERS_RYUK_DISABLED: 'false',
        },
      },
    );
    const result = readJson(report);
    const executed = result.testResults.flatMap((file) =>
      file.assertionResults.map((test) => {
        assert.equal(test.status, 'passed', `${name}: integration test did not pass`);
        return JSON.stringify([file.name, [...test.ancestorTitles, test.title].join(' > ')]);
      }),
    );
    // Compare multisets, preserving duplicate names and checking identity as well
    // as totals: a different test must never stand in for an omitted one.
    assert.deepEqual(
      executed.sort(),
      selected.map((test) => JSON.stringify([test.file, test.name])).sort(),
      `${name}: collection/execution identity mismatch`,
    );
    assert.equal(result.numTotalTests, selected.length, `${name}: collection/execution mismatch`);
    assert(
      result.numTotalTests > 0 && result.numPassedTests === result.numTotalTests,
      `${name}: missing, failed or skipped integration tests`,
    );
    assert.equal(result.numPendingTests, 0);
    assert.equal(result.numFailedTests, 0);
  }
}
if (listOnly) console.log(JSON.stringify(selections, null, 2));
else if (suite === null || suite === 'introspection-consumer') {
  run(process.execPath, ['scripts/check-package.mjs'], {
    env: { ...process.env, GODOO_INSTALLED_ODOO: 'true', ODOO_VERSION: `${major}.0` },
  });
  const runtime = readJson(resolve(dir, `installed-odoo${major}-proof.json`));
  assert.equal(runtime.observedMajor, major);
  // Partial runs must never satisfy the full-candidate Odoo proof.
  if (suite !== null) process.exit(0);
  writeJson(resolve(dir, `odoo${major}-proof.json`), {
    passed: true,
    requestedMajor: major,
    observedMajor: runtime.observedMajor,
    sourceCommit: verifyCandidate(dir).source.commit,
    manifestSha256: sha256(readFileSync(resolve(dir, 'manifest.json'))),
    packageProofSha256: sha256(readFileSync(resolve(dir, 'package-proof.json'))),
    installedProofSha256: sha256(readFileSync(resolve(dir, `installed-odoo${major}-proof.json`))),
    suites: Object.fromEntries(
      packages.map((name) => [
        name,
        {
          count: selections[name].length,
          resultSha256: sha256(readFileSync(resolve(dir, `${name}-odoo${major}-tests.json`))),
        },
      ]),
    ),
  });
}
