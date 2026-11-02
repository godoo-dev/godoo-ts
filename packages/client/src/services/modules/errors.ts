import { type ErrorJSON, OdooError } from '../../types/errors';
import type { ModulePrerequisiteInspection } from './inspection';

/** Refusal/incomplete verification, distinct from unchanged propagated RPC errors. */
export class ModuleLifecycleError extends OdooError {
  constructor(
    message: string,
    public readonly phase: 'prerequisite' | 'stale' | 'postcondition',
    public readonly inspection: ModulePrerequisiteInspection,
    public readonly schemaInvalidated: boolean,
  ) {
    super(message);
    this.name = 'ModuleLifecycleError';
    Object.setPrototypeOf(this, ModuleLifecycleError.prototype);
  }

  override toJSON(): ErrorJSON {
    return {
      error: 'MODULE_LIFECYCLE_ERROR',
      message: this.message,
      details: {
        phase: this.phase,
        inspection: this.inspection,
        schemaInvalidated: this.schemaInvalidated,
      },
    };
  }
}
