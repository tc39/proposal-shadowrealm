import { repairAccessors } from './accessors';
import { repairFunctions } from './functions';

// Sanitizing ensures that neither the legacy
// accessors nor the function constructors can be
// used to escape the confinement of the evaluators
// to execute in the context.

export function sanitize(contextRec) {
  repairAccessors(contextRec);
  repairFunctions(contextRec);
}
