import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outside, readJson, root, verifyCandidate, writeJson } from './check-lib.mjs';

const candidate = outside(process.argv[2]);
const manifest = verifyCandidate(candidate);
const trial = mkdtempSync(join(tmpdir(), 'godoo-candidate-rejection-'));
const results = [];
function reject(name, script, dir, pattern, env = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, CANDIDATE_DIR: dir, ...env },
    encoding: 'utf8',
  });
  const transcript = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
  assert.match(transcript, pattern, `${name} rejected for an unexpected reason`);
  results.push({ name, exit: result.status, signal: result.signal, transcript });
}
try {
  const wrongSource = join(trial, 'wrong-source');
  cpSync(candidate, wrongSource, { recursive: true });
  writeJson(join(wrongSource, 'manifest.json'), {
    ...manifest,
    source: { ...manifest.source, commit: '0'.repeat(40) },
  });
  reject('wrong source', 'scripts/check-package.mjs', wrongSource, /Wrong source commit/);

  const altered = join(trial, 'altered-bytes');
  cpSync(candidate, altered, { recursive: true });
  appendFileSync(join(altered, manifest.packages[0].file), 'intentional isolated corruption');
  reject('altered tarball', 'scripts/check-package.mjs', altered, /Wrong artifact hash/);

  const missing18 = join(trial, 'missing18');
  cpSync(candidate, missing18, { recursive: true });
  rmSync(join(missing18, 'odoo18-proof.json'), { force: true });
  // Use the native package entrypoint so the requested major is passed exactly as in delivery.
  const later = spawnSync('pnpm', ['check:odoo19'], {
    cwd: root,
    env: { ...process.env, CANDIDATE_DIR: missing18, ODOO_VERSION: '19.0' },
    encoding: 'utf8',
  });
  assert.notEqual(later.status, 0);
  const laterTranscript = `${later.stdout ?? ''}${later.stderr ?? ''}`;
  assert.match(laterTranscript, /odoo18-proof.json/);
  results.push({ name: '19 before18', exit: later.status, transcript: laterTranscript });

  const docker = spawnSync('pnpm', ['check:odoo18'], {
    cwd: root,
    env: {
      ...process.env,
      CANDIDATE_DIR: candidate,
      ODOO_VERSION: '18.0',
      DOCKER_CONTEXT: '',
      DOCKER_HOST: `unix://${join(trial, 'unavailable-docker.sock')}`,
    },
    encoding: 'utf8',
  });
  assert.notEqual(docker.status, 0);
  const dockerTranscript = `${docker.stdout ?? ''}${docker.stderr ?? ''}`;
  assert.match(dockerTranscript, /docker info/);
  assert.match(dockerTranscript, /unavailable-docker.sock/);
  results.push({ name: 'missing Docker', exit: docker.status, transcript: dockerTranscript });
  writeJson(join(candidate, 'negative-candidate-proof.json'), {
    passed: true,
    sourceCommit: manifest.source.commit,
    packageProof: readJson(join(candidate, 'package-proof.json')).passed,
    results,
  });
  console.log(
    'Actual package/Odoo callers rejected wrong source, altered bytes,19-before18 and missing Docker',
  );
} finally {
  rmSync(trial, { recursive: true, force: true });
}
