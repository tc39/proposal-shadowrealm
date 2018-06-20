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

// note: in a node module, the top-level 'this' is not the global object,
// however an indirect eval of 'this' will be the correct global object
// todo: in a node 'vm' context, which 'this' do we get?

const unsafeGlobalSrc = `'use strict'; this`;
const unsafeGlobalEvalSrc = `(0, eval)("'use strict'; this")`;

function createNewUnsafeGlobalNode() {
  // Use unsafeGlobalEvalSrc to ensure we get the right 'this'.
  const context = vm.runInNewContext(unsafeGlobalEvalSrc);

  return context;
}

function createNewUnsafeGlobalBrowser() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';

  document.body.appendChild(iframe);
  const context = iframe.contentWindow.eval(unsafeGlobalSrc);
  // todo: we keep the iframe attached. At one point, removing the iframe
  // caused its global object to lose its intrinsics. todo: re-test this.

  return context;
}

const getNewUnsafeGlobal = isNode ? createNewUnsafeGlobalNode : createNewUnsafeGlobalBrowser;

// The unsafeRec is shim-specific. It acts as the mechanism to obtain a fresh
// set of intrinsics together with their associated eval and Function
// evaluators. These must be used as a matched set, since the evaluators are
// tied to a set of intrinsics, aka the "undeniables". If it were possible to
// mix-and-match them from different contexts, that would enable some
// attacks.
function createUnsafeRec(unsafeGlobal) {
  return freeze({
    unsafeGlobal,
    unsafeEval: unsafeGlobal.eval,
    unsafeFunction: unsafeGlobal.Function
  });
}

// todo: NEEDS COMMENT
function sanitizeUnsafeRec(unsafeRec) {
  // Ensures that neither the legacy accessors nor the function constructors
  // can be used to escape the confinement of the evaluators to execute in the
  // context.
  repairAccessors(unsafeRec);
  repairFunctions(unsafeRec);
}

// Create a new unsafeRec from a brand new context, with new intrinsics and a
// new global object
export function createNewUnsafeRec() {
  const unsafeGlobal = getNewUnsafeGlobal();
  const unsafeRec = createUnsafeRec(unsafeGlobal);
  sanitizeUnsafeRec(unsafeRec);
  return unsafeRec;
}

// Create a new unsafeRec from the current context, where the Realm shim is
// being parsed and executed, aka the "Primal Realm"
export function createCurrentUnsafeRec() {
  const unsafeGlobal = (0, eval)(unsafeGlobalSrc);
  const unsafeRec = createUnsafeRec(unsafeGlobal);
  sanitizeUnsafeRec(unsafeRec);
  return unsafeRec;
}
