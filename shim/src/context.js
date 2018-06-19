import { repairAccessors } from './accessors';
import { repairFunctions } from './functions';

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

// note: unsafeRecSrc goes inside a quoted string, so never add more quotes,
// to avoid an injection attack in unsafeRecEvalSrc

const unsafeRecSrc = `'use strict'; Object.freeze({ unsafeGlobal: this, unsafeEval: eval, unsafeFunction: Function }); `;
const unsafeRecEvalSrc = `(0, eval)("${unsafeRecSrc}")`;

function createNodeContext() {
  // we use unsafeRecEvalSrc to ensure we get the right 'this'
  const context = vm.runInNewContext(unsafeRecEvalSrc);

  return context;
}

function createBrowserContext() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';

  document.body.appendChild(iframe);
  const context = iframe.contentWindow.eval(unsafeRecSrc);
  // todo: we keep the iframe attached. At one point, removing the iframe
  // caused its global object to lose its intrinsics. todo: re-test this.

  return context;
}

const createContext = isNode ? createNodeContext : createBrowserContext;

// The unsafeRec is shim-specific. It acts as the mechanism to obtain a fresh
// set of intrinsics together with their associated eval and Function
// evaluators. These must be used as a matched set, since the evaluators are
// tied to a set of intrinsics, aka the "undeniables". If it were possible to
// mix-and-match them from different contexts, that would enable some
// attacks.

// todo: NEEDS COMMENT
function sanitizeUnsafeRec(unsafeRec) {
  // Ensures that neither the legacy accessors nor the function constructors
  // can be used to escape the confinement of the evaluators to execute in the
  // context.
  repairAccessors(unsafeRec);
  repairFunctions(unsafeRec);
}

// create a new unsafeRec from a brand new context, with new intrinsics and a
// new global object
export function createNewUnsafeRec() {
  const unsafeRec = createContext();
  sanitizeUnsafeRec(unsafeRec);
  return unsafeRec;
}

// Create a new unsafeRec from the current context, where the Realm shim is
// being parsed and executed, aka the "Primal Realm"
export function createCurrentUnsafeRec() {
  const unsafeRec = (0, eval)(unsafeRecSrc);
  sanitizeUnsafeRec(unsafeRec);
  return unsafeRec;
}
