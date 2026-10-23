import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const packages = ['client', 'introspection', 'testcontainers'];
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const writeJson = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
export function run(command, args = [], options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
}
export function output(command, args = [], options = {}) {
  return run(command, args, { stdio: 'pipe', encoding: 'utf8', ...options }).trim();
}
export function outside(path) {
  const target = resolve(path);
  const rel = relative(realpathSync(root), target);
  assert(
    rel.startsWith('..') || isAbsolute(rel),
    'Evidence/consumer directory must be outside checkout',
  );
  return target;
}
export function sourceIdentity() {
  const files = output('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0')
    .filter(Boolean)
    .sort();
  const hashes = files.map((file) => [file, sha256(readFileSync(resolve(root, file)))]);
  return {
    commit: output('git', ['rev-parse', 'HEAD']),
    tree: output('git', ['rev-parse', 'HEAD^{tree}']),
    contentSha256: sha256(JSON.stringify(hashes)),
    dirty: output('git', ['status', '--porcelain=v1', '--untracked-files=all']),
    patchSha256: sha256(run('git', ['diff', 'HEAD', '--binary'], { stdio: 'pipe' })),
    lockSha256: sha256(readFileSync(resolve(root, 'pnpm-lock.yaml'))),
    node: process.version,
    pnpm: output('pnpm', ['--version']),
    github: {
      sha: process.env.GITHUB_SHA ?? null,
      head: process.env.PR_HEAD_SHA ?? null,
      base: process.env.PR_BASE_SHA ?? null,
      run: process.env.GITHUB_RUN_ID ?? null,
    },
  };
}
export function verifyCandidate(dir, expectedCommit = output('git', ['rev-parse', 'HEAD'])) {
  const manifest = readJson(resolve(dir, 'manifest.json'));
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.source.commit, expectedCommit, 'Wrong source commit');
  assert.equal(
    manifest.source.contentSha256,
    sourceIdentity().contentSha256,
    'Source content changed since pack',
  );
  assert.deepEqual(
    manifest.packages.map((p) => p.name).sort(),
    packages.map((p) => `@godoo-dev/${p}`).sort(),
  );
  for (const pkg of manifest.packages) {
    assert.equal(pkg.file, `godoo-dev-${pkg.name.split('/')[1]}-${pkg.version}.tgz`);
    assert.equal(
      sha256(readFileSync(resolve(dir, pkg.file))),
      pkg.sha256,
      `Wrong artifact hash: ${pkg.file}`,
    );
    const packed = JSON.parse(
      output('tar', ['-xOf', resolve(dir, pkg.file), 'package/package.json']),
    );
    assert.equal(packed.name, pkg.name);
    assert.equal(packed.version, pkg.version);
    assert.deepEqual(packed.dependencies ?? {}, pkg.dependencies);
    assert.deepEqual(packed.peerDependencies ?? {}, pkg.peerDependencies);
    for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies })) {
      if (name.startsWith('@godoo-dev/')) {
        assert.equal(
          spec,
          manifest.packages.find((p) => p.name === name)?.version,
          `Internal dependency must be exact: ${name}`,
        );
      }
    }
  }
  return manifest;
}
export function requireResults(results, expected = ['offline', 'package', 'odoo18']) {
  assert.deepEqual(
    Object.keys(results).sort(),
    [...expected].sort(),
    'Missing/extra required jobs',
  );
  for (const name of expected)
    assert.equal(results[name]?.result, 'success', `${name} must succeed`);
}
export function requirePackageProof(dir, manifest = verifyCandidate(dir)) {
  const proof = readJson(resolve(dir, 'package-proof.json'));
  assert.equal(proof.passed, true);
  assert.equal(proof.manifestSha256, sha256(readFileSync(resolve(dir, 'manifest.json'))));
  assert.equal(proof.sourceCommit, manifest.source.commit);
  assert.equal(proof.consumerLockSha256, sha256(readFileSync(resolve(dir, 'consumer-lock.yaml'))));
  return proof;
}
export function require18Proof(dir, manifest = verifyCandidate(dir)) {
  requirePackageProof(dir, manifest);
  const proof = readJson(resolve(dir, 'odoo18-proof.json'));
  assert.equal(proof.manifestSha256, sha256(readFileSync(resolve(dir, 'manifest.json'))));
  assert.equal(proof.sourceCommit, manifest.source.commit);
  assert.equal(proof.requestedMajor, 18);
  assert.equal(proof.observedMajor, 18);
  assert.equal(proof.passed, true);
  assert.equal(proof.packageProofSha256, sha256(readFileSync(resolve(dir, 'package-proof.json'))));
  assert.deepEqual(Object.keys(proof.suites).sort(), [...packages].sort());
  for (const name of packages) {
    const bytes = readFileSync(resolve(dir, `${name}-odoo18-tests.json`));
    assert.equal(proof.suites[name].resultSha256, sha256(bytes));
    const result = JSON.parse(bytes);
    assert(result.numTotalTests > 0);
    assert.equal(proof.suites[name].count, result.numTotalTests);
    assert.equal(result.numPassedTests, result.numTotalTests);
    assert.equal(result.numFailedTests, 0);
    assert.equal(result.numPendingTests, 0);
  }
  const installedBytes = readFileSync(resolve(dir, 'installed-odoo18-proof.json'));
  assert.equal(proof.installedProofSha256, sha256(installedBytes));
  const installed = JSON.parse(installedBytes);
  assert.equal(installed.passed, true);
  assert.equal(installed.requestedMajor, 18);
  assert.equal(installed.observedMajor, 18);
  assert.equal(installed.manifestSha256, proof.manifestSha256);
  assert.equal(installed.consumerLockSha256, requirePackageProof(dir, manifest).consumerLockSha256);
  return proof;
}
export function requireMainCandidate(ref = process.env.GITHUB_REF) {
  assert.equal(ref, 'refs/heads/main', 'Promotion requires workflow dispatch on reviewed main');
  assert.equal(
    output('git', ['rev-parse', 'HEAD']),
    output('git', ['rev-parse', 'refs/remotes/origin/main']),
    'Candidate is not the fetched main head',
  );
  assert.equal(
    output('git', ['status', '--porcelain']),
    '',
    'Promotion requires a clean candidate',
  );
}
