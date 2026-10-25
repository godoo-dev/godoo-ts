export type {
  ModuleInspectionClient,
  ModuleInspectionDiagnostic,
  ModuleInspectionOptions,
  ModuleInspectionStatus,
  ModulePrerequisite,
  ModulePrerequisiteInspection,
} from './inspection';
export { inspectModulePrerequisites } from './inspection';
export {
  ModuleLifecycleError,
  type ModuleOperationOptions,
  type ModuleOperationResult,
} from './lifecycle';
export { type ModuleInfo, type ModuleListOptions, ModuleManager } from './module-manager';
