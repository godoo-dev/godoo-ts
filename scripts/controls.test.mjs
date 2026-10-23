import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  packages,
  require18Proof,
  requireMainCandidate,
  requireResults,
  root,
  run,
  sha256,
  sourceIdentity,
  verifyCandidate,
  writeJson,
} from './check-lib.mjs';

const allSuccess = {
  offline: { result: 'success' },
  package: { result: 'success' },
  odoo18: { result: 'success' },
  odoo19: { result: 'skipped' },
};
test('required caller admits all success and rejects failed/skipped/cancelled/missing jobs', () => {
  requireResults(allSuccess);
  for (const name of ['offline', 'package', 'odoo18']) {
    for (const result of ['failure', 'skipped', 'cancelled', undefined]) {
      const jobs = structuredClone(allSuccess);
      if (result) jobs[name].result = result;
      else delete jobs[name];
      const child = spawnSync(process.execPath, ['scripts/required.mjs'], {
        cwd: root,
        env: { ...process.env, RESULTS: JSON.stringify(jobs), QUALIFY19: 'false' },
        encoding: 'utf8',
      });
      assert.notEqual(child.status, 0, `${name}:${result} must fail`);
    }
  }
  const child = spawnSync(process.execPath, ['scripts/required.mjs'], {
    cwd: root,
    env: { ...process.env, RESULTS: JSON.stringify(allSuccess), QUALIFY19: 'false' },
  });
  assert.equal(child.status, 0);
});
test('required consumes requested19 and permits its skip only when unrequested', () => {
  for (const requested of ['true', 'false']) {
    for (const result of ['success', 'failure', 'skipped', 'cancelled', undefined]) {
      const jobs = structuredClone(allSuccess);
      if (result) jobs.odoo19.result = result;
      else delete jobs.odoo19;
      const child = spawnSync(process.execPath, ['scripts/required.mjs'], {
        cwd: root,
        env: { ...process.env, RESULTS: JSON.stringify(jobs), QUALIFY19: requested },
        encoding: 'utf8',
      });
      const admitted = requested === 'true' ? result === 'success' : result === 'skipped';
      assert.equal(child.status === 0, admitted, `${requested}:${result}: ${child.stderr}`);
    }
  }
  const invalid = spawnSync(process.execPath, ['scripts/required.mjs'], {
    cwd: root,
    env: { ...process.env, RESULTS: JSON.stringify(allSuccess), QUALIFY19: 'yes' },
  });
  assert.notEqual(invalid.status, 0);
});
test('verification rejects17 and conflicting requested major before Docker', () => {
  for (const [major, envMajor] of [
    ['17', '17.0'],
    ['18', '17.0'],
  ]) {
    const child = spawnSync(process.execPath, ['scripts/check-odoo.mjs', major], {
      cwd: root,
      env: { ...process.env, ODOO_VERSION: envMajor },
      encoding: 'utf8',
    });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /17 is rejected|ODOO_VERSION conflicts/);
  }
});
test('integration listing collects every package without Docker or global service setup', () => {
  const child = spawnSync(process.execPath, ['scripts/check-odoo.mjs', '18', '--list'], {
    cwd: root,
    env: {
      ...process.env,
      ODOO_VERSION: '18.0',
      DOCKER_CONTEXT: '',
      DOCKER_HOST: 'unix:///tmp/godoo-list-must-not-use-docker.sock',
    },
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(child.status, 0, `${child.stdout}${child.stderr}`);
  const selected = JSON.parse(child.stdout);
  assert.deepEqual(Object.keys(selected).sort(), [...packages].sort());
  for (const name of packages) assert(selected[name].length > 0, `${name}: no collected tests`);
});
test('promotion rejects ineligible branch before querying a registry or granting credentials', () => {
  assert.throws(() => requireMainCandidate('refs/heads/develop'), /reviewed main/);
  assert.throws(() => requireMainCandidate('refs/tags/v0.6.0'), /reviewed main/);
  const child = spawnSync(process.execPath, ['scripts/publish-candidate.mjs'], {
    cwd: root,
    env: { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', GODOO_PUBLISH: 'false' },
    encoding: 'utf8',
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Explicit publish choice/);
});
test('a19 qualification cannot precede matching complete18 proof', () => {
  const dir = mkdtempSync(join(tmpdir(), 'godoo-proof-test-'));
  try {
    writeJson(join(dir, 'manifest.json'), { packages: [] });
    const manifest = { source: { commit: 'fixture' } };
    assert.throws(() => require18Proof(dir, manifest), /ENOENT/);
    writeFileSync(join(dir, 'consumer-lock.yaml'), 'fixture-lock');
    const manifestSha256 = sha256(readFileSync(join(dir, 'manifest.json')));
    const consumerLockSha256 = sha256(readFileSync(join(dir, 'consumer-lock.yaml')));
    writeJson(join(dir, 'package-proof.json'), {
      passed: true,
      sourceCommit: 'fixture',
      manifestSha256,
      consumerLockSha256,
    });
    writeJson(join(dir, 'installed-odoo18-proof.json'), {
      passed: true,
      requestedMajor: 18,
      observedMajor: 18,
      manifestSha256,
      consumerLockSha256,
    });
    const suites = {};
    for (const name of packages) {
      const file = join(dir, `${name}-odoo18-tests.json`);
      writeJson(file, {
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
      });
      suites[name] = { count: 1, resultSha256: sha256(readFileSync(file)) };
    }
    const proof = {
      passed: true,
      requestedMajor: 18,
      observedMajor: 18,
      sourceCommit: 'fixture',
      manifestSha256,
      packageProofSha256: sha256(readFileSync(join(dir, 'package-proof.json'))),
      suites,
      installedProofSha256: sha256(readFileSync(join(dir, 'installed-odoo18-proof.json'))),
    };
    writeJson(join(dir, 'odoo18-proof.json'), proof);
    require18Proof(dir, manifest);
    for (const changed of [
      { passed: false },
      { observedMajor: 19 },
      { sourceCommit: 'stale' },
      { manifestSha256: 'wrong' },
      { suites: {} },
    ]) {
      writeJson(join(dir, 'odoo18-proof.json'), { ...proof, ...changed });
      assert.throws(() => require18Proof(dir, manifest));
    }
    writeJson(join(dir, 'odoo18-proof.json'), proof);
    writeFileSync(join(dir, 'consumer-lock.yaml'), 'changed-lock');
    assert.throws(() => require18Proof(dir, manifest));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('candidate verifier admits matching fixture and refuses wrong source and altered artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'godoo-artifact-test-'));
  try {
    const artifacts = [];
    const source = sourceIdentity();
    mkdirSync(join(dir, 'input/package'), { recursive: true });
    for (const name of packages) {
      const metadata = {
        name: `@godoo-dev/${name}`,
        version: '0.0.0-fixture',
        dependencies: {},
        peerDependencies: {},
      };
      writeJson(join(dir, 'input/package/package.json'), metadata);
      const file = `godoo-dev-${name}-${metadata.version}.tgz`;
      run('tar', ['-czf', join(dir, file), '-C', join(dir, 'input'), 'package']);
      artifacts.push({ ...metadata, file, sha256: sha256(readFileSync(join(dir, file))) });
    }
    writeJson(join(dir, 'manifest.json'), { schema: 1, source, packages: artifacts });
    verifyCandidate(dir);
    assert.throws(() => verifyCandidate(dir, 'wrong-source'), /Wrong source commit/);
    cpSync(resolve(root, 'package.json'), join(dir, artifacts[0].file));
    assert.throws(() => verifyCandidate(dir), /Wrong artifact hash/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('actual release guard accepts clean main and refuses dirty or stale main in an isolated repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'godoo-main-fixture-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    for (const file of ['check-lib.mjs', 'release-guard.mjs'])
      cpSync(join(root, 'scripts', file), join(dir, 'scripts', file));
    const git = (args) => run('git', args, { cwd: dir, stdio: 'pipe' });
    git(['init', '-b', 'main']);
    git(['add', '.']);
    const commit = () =>
      git([
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgSign=false',
        '-c',
        'user.name=Gate fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-m',
        'fixture',
      ]);
    commit();
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    const guard = () =>
      spawnSync(process.execPath, ['scripts/release-guard.mjs'], {
        cwd: dir,
        env: { ...process.env, GITHUB_REF: 'refs/heads/main', CANDIDATE_DIR: '' },
        encoding: 'utf8',
      });
    assert.equal(guard().status, 0);
    writeFileSync(join(dir, 'dirty'), 'fixture');
    assert.notEqual(guard().status, 0);
    git(['add', 'dirty']);
    commit();
    assert.notEqual(guard().status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
