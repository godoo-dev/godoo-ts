import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { publishMissingPackages } from './publish-registry.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'godoo-publish-recovery-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const remote = new Map();
  const uploads = [];
  const packages = ['a', 'b'].map((name) => {
    const bytes = Buffer.from(`candidate ${name}`);
    writeFileSync(join(directory, `${name}.tgz`), bytes);
    return {
      name: `@godoo-fixture/${name}`,
      version: '0.3.0',
      file: `${name}.tgz`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes,
    };
  });
  const fetchImpl = async (url) => {
    const pkg = packages.find((p) => url.includes(encodeURIComponent(p.name)));
    assert(pkg, `Unexpected registry request: ${url}`);
    const bytes = remote.get(pkg.name);
    if (!bytes) return new Response('', { status: 404 });
    if (url.endsWith('.tgz')) return new Response(bytes);
    return Response.json({
      name: pkg.name,
      version: pkg.version,
      dist: { tarball: `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/archive.tgz` },
    });
  };
  const publish = (pkg) => {
    assert(!remote.has(pkg.name), 'Must never attempt an existing version again');
    uploads.push(pkg.name);
    remote.set(pkg.name, pkg.bytes);
  };
  return { directory, remote, uploads, packages, fetchImpl, publish };
}

test('resume after a real callback failure retains A and uploads only missing B', async (t) => {
  const f = fixture(t);
  const manifest = { packages: f.packages };
  await assert.rejects(
    publishMissingPackages(manifest, f.directory, {
      fetchImpl: f.fetchImpl,
      publish(pkg) {
        if (pkg === f.packages[1]) throw new Error('Upload interrupted');
        f.publish(pkg);
      },
    }),
    /Upload interrupted/,
  );
  assert.deepEqual(f.uploads, ['@godoo-fixture/a']);
  const result = await publishMissingPackages(manifest, f.directory, f);
  assert.deepEqual(f.uploads, ['@godoo-fixture/a', '@godoo-fixture/b']);
  assert.deepEqual(
    result.map((r) => r.result),
    ['present', 'published'],
  );
});

test('a later collision blocks all missing uploads before the first write', async (t) => {
  const f = fixture(t);
  f.remote.set(f.packages[1].name, Buffer.from('different published bytes'));
  await assert.rejects(
    publishMissingPackages({ packages: f.packages }, f.directory, f),
    /npm version collision/,
  );
  assert.deepEqual(f.uploads, []);
});

test('lookup authentication and server errors are unknown, never absent', async (t) => {
  for (const status of [401, 403, 503]) {
    const f = fixture(t);
    await assert.rejects(
      publishMissingPackages({ packages: f.packages }, f.directory, {
        ...f,
        fetchImpl: async () => new Response('', { status }),
      }),
      /npm lookup unavailable/,
    );
    assert.deepEqual(f.uploads, []);
  }
});

test('metadata and archive failures do not permit any upload', async (t) => {
  const replies = [
    () => Response.json({ name: 'wrong', version: '0.3.0' }),
    () => Response.json({ name: '@godoo-fixture/a', version: '0.2.0' }),
    () =>
      Response.json({
        name: '@godoo-fixture/a',
        version: '0.3.0',
        dist: { tarball: 'https://untrusted.example/archive.tgz' },
      }),
    (url) =>
      url.endsWith('.tgz')
        ? new Response('', { status: 503 })
        : Response.json({
            name: '@godoo-fixture/a',
            version: '0.3.0',
            dist: { tarball: 'https://registry.npmjs.org/archive.tgz' },
          }),
  ];
  for (const fetchImpl of replies) {
    const f = fixture(t);
    await assert.rejects(
      publishMissingPackages({ packages: f.packages }, f.directory, { ...f, fetchImpl }),
    );
    assert.deepEqual(f.uploads, []);
  }
});
