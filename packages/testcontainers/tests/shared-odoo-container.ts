/**
 * Shared Odoo testcontainer instance for integration tests.
 * Ensures containers are started only once per test suite.
 */
import { type StartedOdooContainer, startOdoo } from '../src/index.js';

let odoo: StartedOdooContainer | undefined;

export async function getSharedOdooContainer() {
  if (!odoo) {
    odoo = await startOdoo({ modules: ['base'] });
  }
  return odoo;
}

export async function cleanupSharedOdooContainer() {
  if (odoo) {
    await odoo.cleanup();
    odoo = undefined;
  }
}
