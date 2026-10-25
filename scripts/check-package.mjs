import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  output,
  outside,
  readJson,
  require18Proof,
  root,
  run,
  sha256,
  verifyCandidate,
  writeJson,
} from './check-lib.mjs';

const dir = outside(process.env.CANDIDATE_DIR ?? mkdtempSync(join(tmpdir(), 'godoo-candidate-')));
if (!existsSync(resolve(dir, 'manifest.json'))) {
  assert(
    !process.env.CANDIDATE_DIR,
    'Supplied candidate must already exist; never rebuild proof inputs',
  );
  run('pnpm', ['build']);
  run(process.execPath, ['scripts/candidate.mjs', 'pack', dir]);
}
const manifest = verifyCandidate(dir);
const major =
  process.env.GODOO_INSTALLED_ODOO === 'true' ? Number(process.env.ODOO_VERSION ?? '18') : null;
assert(major === null || major === 18 || major === 19, 'Only Odoo18 or explicitly qualified19');
if (major === 19) require18Proof(dir, manifest);
if (major) run('docker', ['info'], { stdio: 'pipe', timeout: 30_000 });
const consumer = mkdtempSync(join(tmpdir(), 'godoo-consumer-'));
try {
  mkdirSync(join(consumer, 'tarballs'));
  const dependencies = {};
  for (const pkg of manifest.packages) {
    cpSync(resolve(dir, pkg.file), join(consumer, 'tarballs', pkg.file));
    dependencies[pkg.name] = `file:tarballs/${pkg.file}`;
  }
  const toolchain = readJson(join(root, 'package.json')).devDependencies;
  writeJson(join(consumer, 'package.json'), {
    private: true,
    type: 'module',
    packageManager: 'pnpm@11.1.3',
    dependencies,
    devDependencies: { typescript: toolchain.typescript, '@types/node': toolchain['@types/node'] },
  });
  writeJson(join(consumer, 'pnpm-workspace.yaml'), {
    overrides: Object.fromEntries(
      manifest.packages.map((p) => [p.name, `file:tarballs/${p.file}`]),
    ),
  });
  const lock = resolve(dir, 'consumer-lock.yaml');
  if (existsSync(lock)) cpSync(lock, join(consumer, 'pnpm-lock.yaml'));
  else {
    assert(!major, 'Prepare the frozen consumer lock during package validation first');
    run('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], { cwd: consumer });
    cpSync(join(consumer, 'pnpm-lock.yaml'), lock);
  }
  run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], { cwd: consumer });
  cpSync(join(root, 'scripts/consumer'), consumer, { recursive: true });
  const env = { ...process.env, ODOO_VERSION: `${major ?? 18}.0` };
  run(process.execPath, ['public-api.mjs'], { cwd: consumer, env });
  run(
    'pnpm',
    [
      'exec',
      'tsc',
      '--strict',
      '--noUncheckedIndexedAccess',
      '--noEmit',
      '--module',
      'nodenext',
      '--target',
      'ES2022',

      'public-api.ts',
      'generated.ts',
    ],
    { cwd: consumer },
  );
  const help = output('pnpm', ['exec', 'odoo-introspect', '--help'], { cwd: consumer });
  assert(help.includes('odoo-introspect'), help);
  const proof = {
    passed: true,
    manifestSha256: sha256(readFileSync(resolve(dir, 'manifest.json'))),
    sourceCommit: manifest.source.commit,
    consumerLockSha256: sha256(readFileSync(lock)),
    requestedMajor: major,
    consumer,
    command: 'pnpm check:package',
    cli: help,
  };
  if (major) {
    const runtime = readJson(join(consumer, 'runtime-proof.json'));
    writeJson(resolve(dir, `installed-odoo${major}-proof.json`), { ...proof, ...runtime });
    cpSync(join(consumer, 'generated.ts'), resolve(dir, `odoo${major}-generated.ts`));
  } else writeJson(resolve(dir, 'package-proof.json'), proof);
  console.log(`Candidate ${dir}: installed ${major ? `Odoo${major}` : 'package'} proof passed`);
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
