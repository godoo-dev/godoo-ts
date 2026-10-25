import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type StartedOdooContainer, startOdoo } from '@godoo-dev/testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateCompleteFile, Introspector } from '../src/index.js';

describe('Odoo metadata and generated types', () => {
  let odoo: StartedOdooContainer;
  let introspector: Introspector;
  beforeAll(async () => {
    odoo = await startOdoo({ modules: ['base'], snapshot: false });
    introspector = new Introspector(odoo.client);
  });
  afterAll(async () => {
    await odoo?.cleanup();
  });
  it('reads real model/field metadata and refreshes cache', async () => {
    const metadata = await introspector.getModelMetadata('res.partner');
    expect(metadata.model.model).toBe('res.partner');
    expect(metadata.fields.find((f) => f.name === 'name')?.ttype).toBe('char');
    expect(metadata.fields.find((f) => f.name === 'parent_id')?.relation).toBe('res.partner');
    introspector.clearModelCache('res.partner');
    expect(await introspector.getFields('res.partner', { bypassCache: true })).toEqual(
      metadata.fields,
    );
  });
  it('generates compilable public types from the observed schema', async () => {
    const metadata = await introspector.getModelMetadata('res.partner');
    const code = generateCompleteFile([metadata]);
    expect(code).toContain('export interface ResPartner');
    const dir = await mkdtemp(join(tmpdir(), 'godoo-schema-'));
    try {
      const file = join(dir, 'generated.ts');
      await writeFile(file, code);
      const require = createRequire(import.meta.url);
      execFileSync(
        process.execPath,
        [
          require.resolve('typescript/bin/tsc'),
          '--strict',
          '--noEmit',
          '--ignoreConfig',
          '--types',
          'node',
          '--typeRoots',
          join(require.resolve('@types/node/package.json'), '../..'),
          file,
        ],
        { stdio: 'pipe' },
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
