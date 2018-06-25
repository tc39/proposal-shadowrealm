// Note: do not import anything to this file to prevent using implicit
// dependencies.

// buildChildRealm is immediately turned into a string, and this function is
// never referenced again, because it closes over the wrong intrinsics

function buildChildRealm(BaseRealm) {
  const { defineProperty, getOwnPropertyDescriptors } = Object;
  const { apply, construct } = Reflect;

  const errorConstructors = new Map([
    ['EvalError', EvalError],
    ['RangeError', RangeError],
    ['ReferenceError', ReferenceError],
    ['SyntaxError', SyntaxError],
    ['TypeError', TypeError],
    ['URIError', URIError]
  ]);

  // Like Realm.apply except that it catches anything thrown and rethrows it
  // as an Error from this realm
  function applyAndWrapError(target, thisArgument, ...args) {
    try {
      return apply(target, thisArgument, args);
    } catch (err) {
      if (Object(err) !== err) {
        // err is a primitive value, which is safe to rethrow
        throw err;
      }
      let eName, eMessage, eStack;
      try {
        // The child environment might seek to use 'err' to reach the
        // parent's intrinsics and corrupt them. `${err.name}` will cause
        // string coercion of 'err.name'. If err.name is an object (probably
        // a String of the parent Realm), the coercion uses
        // err.name.toString(), which is under the control of the parent. If
        // err.name were a primitive (e.g. a number), it would use
        // Number.toString(err.name), using the child's version of Number
        // (which the child could modify to capture its argument for later
        // use), however primitives don't have properties like .prototype so
        // they aren't useful for an attack.
        eName = `${err.name}`;
        eMessage = `${err.message}`;
        eStack = `${err.stack}`;
        // eName/eMessage/eStack are now child-realm primitive strings, and
        // safe to expose
      } catch (ignored) {
        // if err.name.toString() throws, keep the (parent realm) Error away
        // from the child
        throw new Error('unknown error');
      }
      const ErrorConstructor = errorConstructors.get(eName) || Error;
      try {
        throw new ErrorConstructor(eMessage);
      } catch (err2) {
        err2.stack = eStack; // replace with the captured inner stack
        throw err2;
      }
    }
  }

  const descs = getOwnPropertyDescriptors(BaseRealm.prototype);
  // eslint-disable-next-line camelcase
  const descs_global_get = descs.global.get;
  // eslint-disable-next-line camelcase
  const descs_evaluate_value = descs.evaluate.value;

  class Realm {
    constructor(...args) {
      return applyAndWrapError(construct, undefined, BaseRealm, args, Realm);
    }
    get global() {
      return applyAndWrapError(descs_global_get, this);
    }
    evaluate(...args) {
      return applyAndWrapError(descs_evaluate_value, this, args);
    }
    static makeRootRealm() {
      return new Realm();
    }
    static makeCompartment() {
      return new Realm({
        transform: 'inherit',
        isDirectEval: 'inherit',
        intrinsics: 'inherit'
      });
    }
  }

  defineProperty(Realm.prototype, 'toString', {
    value: () => 'function Realm() { [shim code] }',
    writable: false,
    enumerable: false,
    configurable: true
  });

  return Realm;
}

// the parentheses means we don't bind the 'buildChildRealm' name inside the
// child's namespace. this would accept an anonymous function declaration.
// function expression (not a declaration) so it has a completion value.
const buildChildRealmString = `'use strict'; (${buildChildRealm})`;

export function createRealmFacade(unsafeRec, BaseRealm) {
  const { unsafeEval } = unsafeRec;

  // The BaseRealm is the Realm class created by
  // the shim. It's only valid for the context where
  // it was parsed.

  // The Realm facade is a lightweight class built in the
  // context a different context, that provide a fully
  // functional Realm class using the intrisics
  // of that context.

  // This process is simplified because all methods
  // and properties on a realm instance already return
  // values using the intrinsics of the realm's context.

  // Invoke the BaseRealm constructor with Realm as the prototype.
  return unsafeEval(buildChildRealmString)(BaseRealm);
}
