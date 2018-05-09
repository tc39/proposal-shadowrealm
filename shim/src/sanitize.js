import { repairAccessors } from './accessors';
import { repairFunctions } from './functions';

// Sanitizing ensures that the neither the legacy
// accessors nor the function constructors can be
// used to escape the confinement of the evaluators
// and execure in the sandbox.

export function sanitize(sandbox) {
  repairAccessors(sandbox);
  repairFunctions(sandbox);
}
