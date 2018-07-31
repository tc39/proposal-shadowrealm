// this module must never be importable outside the Realm shim itself
import { getSharedGlobalDescs } from './stdlib';
import { repairAccessors } from './repair/accessors';
import { repairFunctions } from './repair/functions';
import { cleanupSource } from './utilities';
import { freeze } from './commons';

// A "context" is a fresh unsafe Realm as given to us by existing platforms.
// We need this to implement the shim. However, when Realms land for real,
// this feature will be provided by the underlying engine instead.

// Platform detection.
const isNode = typeof exports === 'object' && typeof module !== 'undefined';
const isBrowser = typeof document === 'object';
if ((!isNode && !isBrowser) || (isNode && isBrowser)) {
  throw new Error('unexpected platform, unable to create Realm');
}
const vm = isNode ? require('vm') : undefined;

// note: in a node module, the top-level 'this' is not the global object
// (it's *something* but we aren't sure what), however an indirect eval of
// 'this' will be the correct global object.

const unsafeGlobalSrc = "'use strict'; this";
const unsafeGlobalEvalSrc = `(0, eval)("'use strict'; this")`;

// This method is only exported for testing purposes.
export function createNewUnsafeGlobalForNode() {
  // Use unsafeGlobalEvalSrc to ensure we get the right 'this'.
  const unsafeGlobal = vm.runInNewContext(unsafeGlobalEvalSrc);

  return unsafeGlobal;
}

// This method is only exported for testing purposes.
export function createNewUnsafeGlobalForBrowser() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';

  document.body.appendChild(iframe);
  const unsafeGlobal = iframe.contentWindow.eval(unsafeGlobalSrc);

  // We keep the iframe attached to the DOM because removing it
  // causes its global object to lose intrinsics, its eval()
  // function to evaluate code, etc.

  // TODO: can we remove and garbage-collect the iframes?

  return unsafeGlobal;
}

const getNewUnsafeGlobal = isNode ? createNewUnsafeGlobalForNode : createNewUnsafeGlobalForBrowser;

// The unsafeRec is shim-specific. It acts as the mechanism to obtain a fresh
// set of intrinsics together with their associated eval and Function
// evaluators. These must be used as a matched set, since the evaluators are
// tied to a set of intrinsics, aka the "undeniables". If it were possible to
// mix-and-match them from different contexts, that would enable some
// attacks.
function createUnsafeRec(unsafeGlobal, allShims = []) {
  const sharedGlobalDescs = getSharedGlobalDescs(unsafeGlobal);

  return freeze({
    unsafeGlobal,
    sharedGlobalDescs,
    unsafeEval: unsafeGlobal.eval,
    unsafeFunction: unsafeGlobal.Function,
    allShims
  });
}

const repairAccessorsShim = cleanupSource(`"use strict"; (${repairAccessors})();`);
const repairFunctionsShim = cleanupSource(`"use strict"; (${repairFunctions})();`);

// Create a new unsafeRec from a brand new context, with new intrinsics and a
// new global object
export function createNewUnsafeRec(allShims) {
  const unsafeGlobal = getNewUnsafeGlobal();
  unsafeGlobal.eval(repairAccessorsShim);
  unsafeGlobal.eval(repairFunctionsShim);
  return createUnsafeRec(unsafeGlobal, allShims);
}

// Create a new unsafeRec from the current context, where the Realm shim is
// being parsed and executed, aka the "Primal Realm"
export function createCurrentUnsafeRec() {
  const unsafeGlobal = (0, eval)(unsafeGlobalSrc);
  repairAccessors();
  repairFunctions();
  return createUnsafeRec(unsafeGlobal);
}
