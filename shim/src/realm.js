import { createRealmFacade } from './realmFacade';
import { createNewUnsafeRec, createCurrentUnsafeRec } from './unsafeRec';
import { createSafeEvaluator, createFunctionEvaluator } from './evaluators';
import { create, defineProperty, defineProperties, freeze } from './commons';

// Create a registry to mimic a private static members on the realm classes.
// We define it in the same module and do not export it.

const UnsafeRecForRealm = new WeakMap();

function getUnsafeRecForRealm(Realm) {
  if (Object(Realm) !== Realm) {
    // Detect non-objects.
    throw new TypeError();
  }
  // spec just says throw TypeError
  // todo: but shim should include a message
  if (!UnsafeRecForRealm.has(Realm)) {
    // Realm has no unsafeRec. Shoud not proceed.
    throw new TypeError();
  }
  return UnsafeRecForRealm.get(Realm);
}

function registerUnsafeRecForRealm(Realm, unsafeRec) {
  if (Object(Realm) !== Realm) {
    // Detect non-objects.
    throw new TypeError();
  }
  // spec just says throw TypeError
  // todo: but shim should include a message
  if (UnsafeRecForRealm.has(Realm)) {
    // Attempt to change an existing unsafeRec on a Realm. Shoud not proceed.
    throw new TypeError(); // todo error string on all of these
  }
  UnsafeRecForRealm.set(Realm, unsafeRec);
}

// Create a registry to mimic a private members on the realm imtances.
// We define it in the same module and do not export it.

const RealmRecForRealmInstance = new WeakMap();

function getRealmRecForRealmInstance(realm) {
  if (Object(realm) !== realm) {
    // Detect non-objects.
    throw new TypeError();
  }
  // spec just says throw TypeError
  // todo: but shim should include a message
  if (!RealmRecForRealmInstance.has(realm)) {
    // Realm instance has no realmRec. Should not proceed.
    throw new TypeError();
  }
  return RealmRecForRealmInstance.get(realm);
}

function registerRealmRecForRealmInstance(realm, realmRec) {
  if (Object(realm) !== realm) {
    // Detect non-objects.
    throw new TypeError();
  }
  // spec just says throw TypeError
  // todo: but shim should include a message
  if (RealmRecForRealmInstance.has(realm)) {
    // Attempt to change an existing realmRec on a realm instance. Should not proceed.
    throw new TypeError();
  }
  RealmRecForRealmInstance.set(realm, realmRec);
}

// Initialize the global variables for the new Realm.
function setDefaultBindings(sharedGlobalDescs, safeGlobal, safeEval, safeFunction) {
  defineProperties(safeGlobal, sharedGlobalDescs);

  defineProperty(safeGlobal, 'eval', {
    value: safeEval,
    writable: true,
    configurable: true
  });

  defineProperty(safeGlobal, 'Function', {
    value: safeFunction,
    writable: true,
    configurable: true
  });
}

function createRealmRec(unsafeRec) {
  const { sharedGlobalDescs, unsafeGlobal } = unsafeRec;

  const safeGlobal = create(unsafeGlobal.Object.prototype);
  const safeEval = createSafeEvaluator(unsafeRec, safeGlobal);
  const safeFunction = createFunctionEvaluator(unsafeRec, safeEval);

  setDefaultBindings(sharedGlobalDescs, safeGlobal, safeEval, safeFunction);

  const realmRec = freeze({
    safeGlobal,
    safeEval,
    safeFunction
  });

  return realmRec;
}

// Define newRealm onto new sharedGlobalDescs, so it can be defined in
// the safeGlobal like the rest of the shared globals.
function createRealmGlobalObject(unsafeRec) {
  // eslint-disable-next-line no-use-before-define
  const Realm = createRealmFacade(unsafeRec, BaseRealm);
  unsafeRec.sharedGlobalDescs.Realm = {
    value: Realm,
    writable: true,
    configurable: true
  };
  return Realm;
}

const BaseRealm = {
  initialize(selfClass, self, options) {
    options = Object(options); // Todo: sanitize
    // note: 'self' is the instance of the Realm, and 'selfClass' is the
    // Realm constructor (facade) we build in buildChildRealm().

    let unsafeRec;
    if (
      options.intrinsics === 'inherit' &&
      options.isDirectEval === 'inherit' &&
      options.transform === 'inherit'
    ) {
      // In "inherit" mode, we create a compartment realm and inherit
      // the context since we share the intrinsics. We create a new
      // set to allow us to define eval() and Function() for the realm.

      unsafeRec = getUnsafeRecForRealm(selfClass);
    } else if (
      options.intrinsics === undefined &&
      options.isDirectEval === undefined &&
      options.transform === undefined
    ) {
      // In 'undefined' mode, intrinics are not provided, we create a root
      // realm using the fresh set of new intrinics from a new context.

      // The unsafe record is returned with its constructors repaired.
      unsafeRec = createNewUnsafeRec();

      // Define Realm onto new sharedGlobalDescs, so it can be copied onto the
      // safeGlobal like the rest of the .
      const Realm = createRealmGlobalObject(unsafeRec);
      registerUnsafeRecForRealm(Realm, unsafeRec);
    } else {
      // note this would leak the parent TypeError, from which the child can
      // access .prototype and the parent's intrinsics, except that the Realm
      // facade catches all errors and translates them into local Error types
      throw new TypeError('Realm only supports undefined or "inherited" intrinsics.');
    }
    const realmRec = createRealmRec(unsafeRec);
    // todo: is this where we run shims? but only in RootRealms, not compartments

    registerRealmRecForRealmInstance(self, realmRec);
  },
  getGlobal(self) {
    const { safeGlobal } = getRealmRecForRealmInstance(self);
    return safeGlobal;
  },
  evaluate(self, x) {
    const { safeEval } = getRealmRecForRealmInstance(self);
    return safeEval(x);
  }
};

// Create the current unsafeRec from the current "primal" realm (the realm
// where the Realm shim is loaded and executed).
const currentUnsafeRec = createCurrentUnsafeRec();
const Realm = createRealmFacade(currentUnsafeRec, BaseRealm);
registerUnsafeRecForRealm(Realm, currentUnsafeRec);

export default Realm;
