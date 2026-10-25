import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { output, root, sourceIdentity, writeJson } from './check-lib.mjs';

// No edits to the active checkout: copy task inputs and install a frozen isolated workspace.
const dir = mkdtempSync(join(tmpdir(), 'godoo-type-negative-'));
const results = [];
try {
  const files = output('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0')
    .filter(Boolean);
  for (const file of files) {
    const target = join(dir, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, file), target);
  }
  const installed = spawnSync('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], {
    cwd: dir,
    encoding: 'utf8',
  });
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  const invoke = () => spawnSync('pnpm', ['typecheck'], { cwd: dir, encoding: 'utf8' });
  const initial = invoke();
  assert.equal(initial.status, 0, initial.stdout + initial.stderr);
  for (const file of [
    'packages/client/src/client/config.ts',
    'packages/introspection/tests/codegen.test.ts',
  ]) {
    const target = join(dir, file);
    const original = readFileSync(target);
    writeFileSync(target, `${original}\nexport const deliberateTypeViolation: string = 42;\n`);
    const rejected = invoke();
    assert.notEqual(rejected.status, 0, `${file}: authoritative check accepted a type error`);
    assert.match(rejected.stdout + rejected.stderr, /TS2322/);
    results.push({ file, exit: rejected.status, output: rejected.stdout + rejected.stderr });
    writeFileSync(target, original);
  }
  const restored = invoke();
  assert.equal(restored.status, 0, restored.stdout + restored.stderr);
  console.log(
    JSON.stringify(
      {
        source: sourceIdentity(),
        baselineExit: initial.status,
        violations: results,
        restoredExit: restored.status,
      },
      null,
      2,
    ),
  );
  if (process.env.NEGATIVE_EVIDENCE)
    writeJson(process.env.NEGATIVE_EVIDENCE, {
      source: sourceIdentity(),
      baselineExit: initial.status,
      violations: results,
      restoredExit: restored.status,
    });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
