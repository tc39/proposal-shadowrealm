import { cleanupSource } from './utilities';

// buildChildRealm is immediately turned into a string, and this function is
// never referenced again, because it closes over the wrong intrinsics

export function buildChildRealm(unsafeRec, BaseRealm) {
  const { initRootRealm, initCompartment, getRealmGlobal, realmEvaluate } = BaseRealm;

  // This Object and Reflect are brand new, from a new unsafeRec, so no user
  // code has been run or had a chance to manipulate them. We extract these
  // properties for brevity, not for security. Don't ever run this function
  // *after* user code has had a chance to pollute its environment, or it
  // could be used to gain access to BaseRealm and primal-realm Error
  // objects.
  const { create, defineProperties } = Object;

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
  function callAndWrapError(target, ...args) {
    try {
      return target(...args);
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
        eStack = `${err.stack || eMessage}`;
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

  class Realm {
    constructor() {
      // The Realm constructor is not intended to be used with the new operator
      // or to be subclassed. It may be used as the value of an extends clause
      // of a class definition but a super call to the Realm constructor will
      // cause an exception.

      // When Realm is called as a function, an exception is also raised because
      // a class constructor cannot be invoked without 'new'.
      throw new TypeError('Realm is not a constructor');
    }

    static makeRootRealm(options) {
      // This is the exposed interface.
      options = Object(options); // todo: sanitize

      // Bypass the constructor.
      const r = create(Realm.prototype);
      callAndWrapError(initRootRealm, unsafeRec, r, options);
      return r;
    }

    static makeCompartment() {
      // Bypass the constructor.
      const r = create(Realm.prototype);
      callAndWrapError(initCompartment, unsafeRec, r);
      return r;
    }

    // we omit the constructor because it is empty. All the personalization
    // takes place in one of the two static methods,
    // makeRootRealm/makeCompartment

    get global() {
      // this is safe against being called with strange 'this' because
      // baseGetGlobal immediately does a trademark check (it fails unless
      // this 'this' is present in a weakmap that is only populated with
      // legitimate Realm instances)
      return callAndWrapError(getRealmGlobal, this);
    }

    evaluate(x, endowments) {
      // safe against strange 'this', as above
      return callAndWrapError(realmEvaluate, this, x, endowments);
    }
  }

  defineProperties(Realm, {
    toString: {
      value: () => 'function Realm() { [shim code] }',
      writable: false,
      enumerable: false,
      configurable: true
    }
  });

  defineProperties(Realm.prototype, {
    toString: {
      value: () => '[object Realm]',
      writable: false,
      enumerable: false,
      configurable: true
    }
  });

  return Realm;
}

// The parentheses means we don't bind the 'buildChildRealm' name inside the
// child's namespace. this would accept an anonymous function declaration.
// function expression (not a declaration) so it has a completion value.
const buildChildRealmString = cleanupSource(`'use strict'; (${buildChildRealm})`);

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
  return unsafeEval(buildChildRealmString)(unsafeRec, BaseRealm);
}
