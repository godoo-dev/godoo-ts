import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registry = 'https://registry.npmjs.org';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Inspect the complete set before any upload. Existing promotion guards remain
// in publish-candidate.mjs; this module owns exact-byte registry recovery only.
export async function publishMissingPackages(manifest, directory, { publish, fetchImpl = fetch }) {
  assert.equal(typeof publish, 'function');
  const results = [];
  const missing = [];
  for (const pkg of manifest.packages) {
    assert.equal(digest(readFileSync(resolve(directory, pkg.file))), pkg.sha256);
    const response = await fetchImpl(
      `${registry}/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`,
      { signal: AbortSignal.timeout(30_000), redirect: 'error' },
    );
    if (response.status === 404) {
      missing.push(pkg);
      continue;
    }
    assert(response.ok, `npm lookup unavailable for ${pkg.name}: HTTP ${response.status}`);
    const metadata = await response.json();
    assert.equal(metadata.name, pkg.name, 'npm metadata name mismatch');
    assert.equal(metadata.version, pkg.version, 'npm metadata version mismatch');
    const tarball = new URL(metadata.dist.tarball);
    assert.equal(tarball.origin, registry, 'Unexpected npm archive origin');
    assert(!tarball.username && !tarball.password, 'Unexpected npm archive credentials');
    const archive = await fetchImpl(tarball.href, {
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    assert(archive.ok, `npm archive unavailable for ${pkg.name}: HTTP ${archive.status}`);
    const observed = digest(Buffer.from(await archive.arrayBuffer()));
    assert.equal(observed, pkg.sha256, `npm version collision: ${pkg.name}@${pkg.version}`);
    results.push({ name: pkg.name, version: pkg.version, result: 'present', sha256: observed });
  }
  for (const pkg of missing) {
    await publish(pkg);
    results.push({ name: pkg.name, version: pkg.version, result: 'published', sha256: pkg.sha256 });
  }
  return results;
}
