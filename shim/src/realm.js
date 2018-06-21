import { createNewUnsafeRec, createCurrentUnsafeRec } from './unsafeRec';
import { createSafeEvaluator, createFunctionEvaluator } from './evaluators';
import { getStdLib } from './stdlib';
import { getSharedIntrinsics } from './intrinsics';
import {
  assign,
  create,
  defineProperty,
  defineProperties,
  freeze,
  getPrototypeOf
} from './commons';

const Realm2RealmRec = new WeakMap();
const RealmProto2UnsafeRec = new WeakMap();

// buildChildRealm is immediately turned into a string, and this function is
// never referenced again, because it closes over the wrong intrinsics
function buildChildRealm(BaseRealm) {

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
  function doAndWrapError(thunk) {
    try {
      return thunk();
    } catch (err) {
      if (Object(err) !== err) {
        // err is a primitive value, which is safe to rethrow
        throw err;
      }
      let eName, eMessage;
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
        // eName and eMessage are now child-realm primitive strings, and safe
        // to expose
      } catch (ignored) {
        // if err.name.toString() throws, keep the (parent realm) Error away
        // from the child
        throw new Error('unknown error');
      }
      const ErrorConstructor = errorConstructors.get(eName) || Error;
      // note: this drops the stack trace. todo: stringify and copy
      throw new ErrorConstructor(eMessage);
    }
  }

  const descs = Object.getOwnPropertyDescriptors(BaseRealm.prototype);

  class Realm {
    constructor(...args) {
      // todo: protect these 'apply' values
      // use the constructor from BaseRealm, 
      return doAndWrapError(() => Reflect.construct(BaseRealm, args, Realm));
    }
    /*get intrinsics() {
      return doAndWrapError(() => descs.intrinsics.get.apply(this));
    }*/
    get global() {
      // todo: protect these 'apply' values
      return doAndWrapError(() => descs.global.get.apply(this));
    }
    evaluate(...args) {
      return doAndWrapError(() => descs.evaluate.value.apply(this, args));
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

  Object.defineProperty(Realm.prototype, 'toString', {
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

function createRealmFacade(unsafeRec, BaseRealm) {
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

// initialize the global variables for the new Realm
function setDefaultBindings(realmRec) {
  const descs = getStdLib(realmRec);
  defineProperties(realmRec.globalObject, descs);
}

function createRealmRec(unsafeRec) {
  const sharedIntrinsics = getSharedIntrinsics(unsafeRec);
  const globalObject = create(sharedIntrinsics.ObjectPrototype);

  const safeEval = createSafeEvaluator(unsafeRec, globalObject);
  const safeFunction = createFunctionEvaluator(unsafeRec, safeEval);

  const realmRec = freeze({
    sharedIntrinsics,
    globalObject,
    safeEval,
    safeFunction
  });

  setDefaultBindings(realmRec);
  return realmRec;
}

// todo naming
function getRealmRecForRealm(O) {
  if (Object(O) !== O) {
    throw new TypeError();
  } // catch non-objects
  // spec just says throw TypeError
  // todo: but shim should include a message
  if (!Realm2RealmRec.has(O)) {
    throw new TypeError();
  }
  return Realm2RealmRec.get(O);
}

export default class Realm {
  constructor(options) {
    options = Object(options); // Todo: sanitize

    if (options.thisValue !== undefined) {
      throw new TypeError('Realm only supports undefined thisValue.');
    }

    let unsafeRec;
    if (
      options.intrinsics === 'inherit' &&
      options.isDirectEval === 'inherit' &&
      options.transform === 'inherit'
    ) {
      // In "inherit" mode, we create a compartment realm and inherit
      // the context since we share the intrinsics. We create a new
      // set to allow us to define eval() and Function() for the realm.

      // Class constructor only has a [[Construct]] behavior and not
      // a call behavior, therefore the use of "this" cannot be bound
      // by an adversary.

      // note: this 'this' comes from the Reflect.construct call in the
      // facade we build above, inside buildChildRealm(). 

      // todo: what if 'this' is e.g. Window but set to inherit from a Realm?
      // confused deputy / private field question. A: it can't be, we're in a
      // constructor, and constructors can't be invoked directly as
      // functions, using a class protects us here
      unsafeRec = RealmProto2UnsafeRec.get(getPrototypeOf(this));
    } else if (
      options.intrinsics === undefined &&
      options.isDirectEval === undefined &&
      options.transform === undefined
    ) {
      // When intrinics are not provided, we create a root realm
      // using the fresh set of new intrinics from a new context.
      unsafeRec = createNewUnsafeRec(); // this repairs the constructors too
      //const newRealm = unsafeRec.unsafeEval(buildChildRealmString)(Realm);
      const newRealm = createRealmFacade(unsafeRec, Realm);
      // put new Realm onto new unsafeGlobal, so it can be copied onto the
      // safeGlobal like the rest of the intrinsics
      unsafeRec.unsafeGlobal.Realm = newRealm;
      // todo: make a library function named 'register', add more checking
      // todo: use 'newRealm' as the key, not 'newRealm.prototype'
      RealmProto2UnsafeRec.set(newRealm.prototype, unsafeRec);
    } else {
      // note this would leak the parent TypeError, from which the child can
      // access .prototype and the parent's intrinsics, except that the Realm
      // facade catches all errors and translates them into local Error types
      throw new TypeError('Realm only supports undefined or "inherited" intrinsics.');
    }
    const realmRec = createRealmRec(unsafeRec);
    // todo: is this where we run shims? but only in RootRealms, not compartments

    // note: we never invoke a method on 'this', we only use it as a key in
    // the weakmap. Never say "this." anywhere.
    Realm2RealmRec.set(this, realmRec);
  }
  /*get intrinsics() {
    // todo: delete this, it's probably impossible to use safely
    const realmRec = getRealmRecForRealm(this);
    const intrinsics = realmRec.sharedIntrinsics;
    // The object returned has its prototype
    // match the ObjectPrototype of the realm.
    const obj = create(intrinsics.ObjectPrototype);
    return assign(obj, intrinsics);
  }*/
  get global() {
    const { globalObject } = getRealmRecForRealm(this);
    return globalObject;
  }
  evaluate(x) {
    const { safeEval } = getRealmRecForRealm(this);
    return safeEval(x);
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

// Create the unsafeRec from the current realm (the realm where the
// Realm shim is loaded and executed).
RealmProto2UnsafeRec.set(Realm.prototype, createCurrentUnsafeRec());

defineProperty(Realm.prototype, 'toString', {
  value: () => 'function Realm() { [shim code] }',
  writable: false,
  enumerable: false,
  configurable: true
});
