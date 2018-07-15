import { freeze, getPrototypeOf, objectHasOwnProperty } from './commons';
import { throwTantrum } from './utilities';

/**
 * alwaysThrowHandler is a proxy handler which throws on any trap called.
 * It's made from a proxy with a get trap that throws. Its target is
 * an immutable (frozen) object and is safe to share.
 */
const alwaysThrowHandler = new Proxy(freeze({}), {
  get(target, prop) {
    throwTantrum(`unexpected scope handler trap called: ${prop}`);
  }
});

/**
 * ScopeHandler manages a Proxy which serves as the global scope for the
 * safeEvaluator operation (the Proxy is the argument of a 'with' binding).
 * As described in createSafeEvaluator(), it has several functions:
 * - allow the very first (and only the very first) use of 'eval' to map to
 *   the real (unsafe) eval function, so it acts as a 'direct eval' and can
 *    access its lexical scope (which maps to the 'with' binding, which the
 *   ScopeHandler also controls).
 * - ensure that all subsequent uses of 'eval' map to the safeEvaluator,
 *   which lives as the 'eval' property of the safeGlobal.
 * - route all other property lookups at the safeGlobal.
 * - hide the unsafeGlobal which lives on the scope chain above the 'with'.
 * - ensure the Proxy invariants despite some global properties being frozen.
 */
export function createScopeHandler(unsafeRec) {
  const { unsafeGlobal, unsafeEval } = unsafeRec;

  // This flag allow us to determine if the eval() call is an done by the
  // realm's code or if it is user-land invocation, so we can react differently.
  let useUnsafeEvaluator = false;

  return {
    // The scope handler throws if any trap other than get/set/has are run
    // (e.g. getOwnPropertyDescriptors, apply, getPrototypeOf).
    // eslint-disable-next-line no-proto
    __proto__: alwaysThrowHandler,

    allowUnsafeEvaluatorOnce() {
      useUnsafeEvaluator = true;
    },

    unsafeEvaluatorAllowed() {
      return useUnsafeEvaluator;
    },

    get(target, prop) {
      // Special treatment for eval. The very first lookup of 'eval' gets the
      // unsafe (real direct) eval, so it will get the lexical scope that uses
      // the 'with' context.
      if (prop === 'eval') {
        // test that it is true rather than merely truthy
        if (useUnsafeEvaluator === true) {
          // revoke before use
          useUnsafeEvaluator = false;
          return unsafeEval;
        }
        return target.eval;
      }

      // todo: shim integrity, capture Symbol.unscopables
      if (prop === Symbol.unscopables) {
        // Safe to return a primal realm Object here because the only code that
        // can do a get() on a non-string is the internals of with() itself,
        // and the only thing it does is to look for properties on it. User
        // code cannot do a lookup on non-strings.
        return undefined;
      }

      // Properties of the global.
      if (prop in target) {
        return target[prop];
      }

      // Prevent the lookup for other properties.
      return undefined;
    },

    // eslint-disable-next-line class-methods-use-this
    set(target, prop, value) {
      // todo: allow modifications when target.hasOwnProperty(prop) and it
      // is writable, assuming we've already rejected overlap (see
      // createSafeEvaluatorFactory.factory). This TypeError gets replaced with
      // target[prop] = value
      if (objectHasOwnProperty(target, prop)) {
        // todo: shim integrity: TypeError, String
        throw new TypeError(`do not modify endowments like ${String(prop)}`);
      }

      // todo (optimization): keep a reference to the shadow avoids calling
      // getPrototypeOf on the target every time the set trap is invoked,
      // since safeGlobal === getPrototypeOf(target).
      getPrototypeOf(target)[prop] = value;

      // Return true after successful set.
      return true;
    },

    // we need has() to return false for some names to prevent the lookup  from
    // climbing the scope chain and eventually reaching the unsafeGlobal
    // object, which is bad.

    // note: unscopables! every string in Object[Symbol.unscopables]

    // todo: we'd like to just have has() return true for everything, and then
    // use get() to raise a ReferenceError for anything not on the safe global.
    // But we want to be compatible with ReferenceError in the normal case and
    // the lack of ReferenceError in the 'typeof' case. Must either reliably
    // distinguish these two cases (the trap behavior might be different), or
    // we rely on a mandatory source-to-source transform to change 'typeof abc'
    // to XXX. We already need a mandatory parse to prevent the 'import',
    // since it's a special form instead of merely being a global variable/

    // note: if we make has() return true always, then we must implement a
    // set() trap to avoid subverting the protection of strict mode (it would
    // accept assignments to undefined globals, when it ought to throw
    // ReferenceError for such assignments)

    has(target, prop) {
      // proxies stringify 'prop', so no TOCTTOU danger here

      // unsafeGlobal: hide all properties of unsafeGlobal at the expense of 'typeof'
      // being wrong for those properties. For example, in the browser, evaluating
      // 'document = 3', will add a property to  safeGlobal instead of throwing a
      // ReferenceError.
      if (prop === 'eval' || prop in target || prop in unsafeGlobal) {
        return true;
      }

      return false;
    }
  };
}
