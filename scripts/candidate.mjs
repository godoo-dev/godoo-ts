import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  output,
  outside,
  packages,
  readJson,
  root,
  run,
  sha256,
  sourceIdentity,
  verifyCandidate,
  writeJson,
} from './check-lib.mjs';

const [operation, destination] = process.argv.slice(2);
assert(destination, 'Usage: node scripts/candidate.mjs pack|verify DIRECTORY');
const dir = outside(destination);
if (operation === 'verify') {
  verifyCandidate(dir);
} else {
  assert.equal(operation, 'pack');
  assert(
    !existsSync(resolve(dir, 'manifest.json')),
    'Immutable candidate already exists; choose a new directory',
  );
  mkdirSync(dir, { recursive: true });
  const source = sourceIdentity();
  const artifacts = [];
  for (const name of packages) {
    const metadata = readJson(resolve(root, 'packages', name, 'package.json'));
    run('pnpm', ['--dir', `packages/${name}`, 'pack', '--pack-destination', dir]);
    const file = `godoo-dev-${name}-${metadata.version}.tgz`;
    const packed = JSON.parse(output('tar', ['-xOf', resolve(dir, file), 'package/package.json']));
    assert.equal(packed.name, metadata.name);
    artifacts.push({
      name: packed.name,
      version: packed.version,
      file,
      sha256: sha256(readFileSync(resolve(dir, file))),
      dependencies: packed.dependencies ?? {},
      peerDependencies: packed.peerDependencies ?? {},
    });
  }
  writeJson(resolve(dir, 'manifest.json'), { schema: 1, source, packages: artifacts });
  verifyCandidate(dir);
  console.log(resolve(dir, 'manifest.json'));
}
