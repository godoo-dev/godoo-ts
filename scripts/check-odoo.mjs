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
const dir = process.env.CANDIDATE_DIR ? outside(process.env.CANDIDATE_DIR) : null;
if (!listOnly) {
  assert(dir, 'CANDIDATE_DIR must identify the packed and package-tested candidate');
  const manifest = verifyCandidate(dir);
  if (major === 19) require18Proof(dir, manifest);
  requirePackageProof(dir, manifest);
  run('docker', ['info'], { stdio: 'pipe', timeout: 30_000 });
}
const selections = {};
for (const name of packages) {
  const cwd = resolve(root, 'packages', name);
  const selected = JSON.parse(
    output(
      'pnpm',
      ['exec', 'vitest', 'list', '--config', 'vitest.integration.config.ts', '--json'],
      { cwd },
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
        env: { ...process.env, ODOO_VERSION: `${major}.0`, TESTCONTAINERS_RYUK_DISABLED: 'false' },
      },
    );
    const result = readJson(report);
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
else {
  run(process.execPath, ['scripts/check-package.mjs'], {
    env: { ...process.env, GODOO_INSTALLED_ODOO: 'true', ODOO_VERSION: `${major}.0` },
  });
  const runtime = readJson(resolve(dir, `installed-odoo${major}-proof.json`));
  assert.equal(runtime.observedMajor, major);
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
