/**
 * Code generation module.
 *
 * Exports:
 * - CodeGenerator - Main orchestrator for code generation
 * - generateCode - Convenience function
 * - Type mappers - Field type mapping utilities
 * - Formatter - Code formatting and output generation
 */

export {
  generateCompleteFile,
  generateHelperTypes,
  generateModelInterface,
  modelNameToInterfaceName,
} from './formatter.js';
export type { CodeGeneratorOptions } from './generator.js';
export { CodeGenerator, generateCode } from './generator.js';
export type { TypeScriptTypeExpression } from './type-mappers.js';
export {
  generateFieldJSDoc,
  getFieldTypeExpression,
  isWritableField,
  mapFieldType,
} from './type-mappers.js';
