/**
 * Integration tests for custom addons mounting in Odoo testcontainer.
 *
 * Tests various ways to mount custom addons from local directories.
 */

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type StartedOdooContainer, startOdoo } from '../src/index.js';

describe('Custom Addons Mounting', () => {
  let fixtureRoot: string;
  beforeAll(async () => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), 'godoo-addons-'));
    for (const name of ['test-addons', 'oca-addons', 'custom-addons', 'oca-server-tools'])
      await mkdir(path.join(fixtureRoot, name));
  });
  afterAll(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });
  describe('Single addon directory', () => {
    let odoo: StartedOdooContainer;

    beforeAll(async () => {
      // This would mount a local addon directory
      // In a real test, you'd have test addons in the repo
      odoo = await startOdoo({
        snapshot: false,
        modules: ['base'],
        addonsPath: path.resolve(fixtureRoot, 'test-addons'), // absolute path required for Docker on CI
        startupTimeout: 300_000,
      });
    }, 600_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should mount addons directory', () => {
      // Basic test that container started successfully with addons
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    });
  });

  describe('Multiple addon directories', () => {
    let odoo: StartedOdooContainer;

    beforeAll(async () => {
      odoo = await startOdoo({
        snapshot: false,
        modules: ['base'],
        addonsPath: [
          {
            source: path.resolve(fixtureRoot, 'oca-addons'), // absolute path required for Docker on CI
            target: '/mnt/oca-addons',
            mode: 'ro',
          },
          {
            source: path.resolve(fixtureRoot, 'custom-addons'), // absolute path required for Docker on CI
            target: '/mnt/custom-addons',
            mode: 'ro',
          },
        ],
        startupTimeout: 300_000,
      });
    }, 600_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should mount multiple addon directories', () => {
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    });
  });

  describe('OCA preset with addons', () => {
    let odoo: StartedOdooContainer;

    beforeAll(async () => {
      // This demonstrates using the OCA preset with a local OCA checkout
      odoo = await startOdoo({
        snapshot: false,
        modules: ['base', 'account'], // Core modules
        addonsPath: path.resolve(fixtureRoot, 'oca-server-tools'), // absolute path required for Docker on CI
        startupTimeout: 300_000,
      });
    }, 600_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should work with OCA addons', () => {
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    });
  });
});
