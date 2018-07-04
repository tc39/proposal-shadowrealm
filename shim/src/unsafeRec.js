// this module must never be importable outside the Realm shim itself
import { getSharedGlobalDescs } from './stdlib';
import { repairAccessors } from './accessors';
import { repairFunctions } from './functions';
import { freeze } from './commons';

// A "context" is a fresh unsafe Realm as given to us by existing platforms.
// We need this to implement the shim. However, when Realms land for real,
// this feature will be provided by the underlying engine instead.

// Detection used in RollupJS.
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

function createNewUnsafeGlobalForNode() {
  // Use unsafeGlobalEvalSrc to ensure we get the right 'this'.
  const unsafeGlobal = vm.runInNewContext(unsafeGlobalEvalSrc);

  return unsafeGlobal;
}

function createNewUnsafeGlobalForBrowser() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';

  document.body.appendChild(iframe);
  const unsafeGlobal = iframe.contentWindow.eval(unsafeGlobalSrc);
  // todo: we keep the iframe attached. At one point, removing the iframe
  // caused its global object to lose its intrinsics. todo: re-test this.

  return unsafeGlobal;
}

// we only export this so test-repair.js can get an unrepaired
// Object.prototype, to sense if this platform has the buggy behavior
export const getNewUnsafeGlobal = isNode
  ? createNewUnsafeGlobalForNode
  : createNewUnsafeGlobalForBrowser;

// The unsafeRec is shim-specific. It acts as the mechanism to obtain a fresh
// set of intrinsics together with their associated eval and Function
// evaluators. These must be used as a matched set, since the evaluators are
// tied to a set of intrinsics, aka the "undeniables". If it were possible to
// mix-and-match them from different contexts, that would enable some
// attacks.
function createUnsafeRec(unsafeGlobal, allShims) {
  const sharedGlobalDescs = getSharedGlobalDescs(unsafeGlobal);

  return freeze({
    unsafeGlobal,
    sharedGlobalDescs,
    unsafeEval: unsafeGlobal.eval,
    unsafeFunction: unsafeGlobal.Function,
    allShims
  });
}

const repairAccessorsShim = `"use strict"; (${repairAccessors})();`;
const repairFunctionsShim = `"use strict"; (${repairFunctions})();`;

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
  return createUnsafeRec(unsafeGlobal, []);
}
