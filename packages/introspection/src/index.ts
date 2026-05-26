/**
 * @godoo-dev/introspection
 *
 * TypeScript introspection and code generation for Odoo models.
 *
 * Provides:
 * - Runtime introspection of Odoo models and fields via ir.model
 * - TypeScript interface generation from Odoo schemas
 * - CLI tool for code generation (odoo-introspect)
 *
 * Usage:
 * ```typescript
 * import { OdooClient } from '@godoo-dev/client';
 * import { Introspector } from '@godoo-dev/introspection';
 *
 * const client = new OdooClient({ ... });
 * await client.authenticate();
 *
 * const introspector = new Introspector(client);
 * const models = await introspector.getModels();
 * const metadata = await introspector.getModelMetadata('res.partner');
 * ```
 *
 * @packageDocumentation
 */

export * from './codegen/index.js';
export * from './introspection/index.js';
