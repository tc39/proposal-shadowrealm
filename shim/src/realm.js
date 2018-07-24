import { createRealmFacade } from './realmFacade';
import { createNewUnsafeRec, createCurrentUnsafeRec } from './unsafeRec';
import {
  createSafeEvaluatorFactory,
  createSafeEvaluator,
  createSafeEvaluatorWhichTakesEndowments,
  createFunctionEvaluator
} from './evaluators';
import { assert } from './utilities';
import { create, defineProperties, freeze, arrayConcat } from './commons';

// Mimic private members on the realm imtances.
// We define it in the same module and do not export it.
const RealmRecForRealmInstance = new WeakMap();

function getRealmRecForRealmInstance(realm) {
  // Detect non-objects.
  assert(Object(realm) === realm, 'bad object, not a Realm instance');
  // Realm instance has no realmRec. Should not proceed.
  assert(RealmRecForRealmInstance.has(realm), 'Realm instance has no record');

  return RealmRecForRealmInstance.get(realm);
}

function registerRealmRecForRealmInstance(realm, realmRec) {
  // Detect non-objects.
  assert(Object(realm) === realm, 'bad object, not a Realm instance');
  // Attempt to change an existing realmRec on a realm instance. Should not proceed.
  assert(!RealmRecForRealmInstance.has(realm), 'Realm instance already has a record');

  RealmRecForRealmInstance.set(realm, realmRec);
}

// Initialize the global variables for the new Realm.
function setDefaultBindings(sharedGlobalDescs, safeGlobal, safeEval, safeFunction) {
  defineProperties(safeGlobal, sharedGlobalDescs);

  defineProperties(safeGlobal, {
    eval: {
      value: safeEval,
      writable: true,
      configurable: true
    },
    Function: {
      value: safeFunction,
      writable: true,
      configurable: true
    }
  });
}

function createRealmRec(unsafeRec) {
  const { sharedGlobalDescs, unsafeGlobal } = unsafeRec;

  const safeGlobal = create(unsafeGlobal.Object.prototype);
  const safeEvaluatorFactory = createSafeEvaluatorFactory(unsafeRec, safeGlobal);
  const safeEval = createSafeEvaluator(safeEvaluatorFactory);
  const safeEvalWhichTakesEndowments = createSafeEvaluatorWhichTakesEndowments(
    safeEvaluatorFactory
  );
  const safeFunction = createFunctionEvaluator(unsafeRec, safeEval);

  setDefaultBindings(sharedGlobalDescs, safeGlobal, safeEval, safeFunction);

  const realmRec = freeze({
    safeGlobal,
    safeEval,
    safeEvalWhichTakesEndowments,
    safeFunction
  });

  return realmRec;
}

function initRootRealm(parentUnsafeRec, self, options) {
  options = Object(options); // todo: sanitize

  // In 'undefined' mode, intrinics are not provided, we create a root
  // realm using the fresh set of new intrinics from a new context.

  // todo: investigate attacks via Array.species
  // todo: this accepts newShims='string', but it should reject that
  const { shims: newShims } = options;
  const allShims = arrayConcat(parentUnsafeRec.allShims, newShims);

  // The unsafe record is returned with its constructors repaired.
  const unsafeRec = createNewUnsafeRec(allShims);

  // Define Realm onto new sharedGlobalDescs, so it can be copied onto the
  // safeGlobal like the rest of the globals.
  // eslint-disable-next-line no-use-before-define
  createRealmGlobalObject(unsafeRec);

  const realmRec = createRealmRec(unsafeRec);
  registerRealmRecForRealmInstance(self, realmRec);

  // Now run all shims in the new RootRealm. We don't do this for
  // compartments.
  const { safeEvalWhichTakesEndowments } = realmRec;
  for (const shim of allShims) {
    safeEvalWhichTakesEndowments(shim);
  }
}

function initCompartment(unsafeRec, self) {
  // note: 'self' is the instance of the Realm, and 'selfClass' is the
  // Realm constructor (facade) we build in buildChildRealm().

  // In "inherit" mode, we create a compartment realm and inherit
  // the context since we share the intrinsics. We create a new
  // set to allow us to define eval() and Function() for the realm.
  const realmRec = createRealmRec(unsafeRec);
  registerRealmRecForRealmInstance(self, realmRec);
}

function getRealmGlobal(self) {
  const { safeGlobal } = getRealmRecForRealmInstance(self);
  return safeGlobal;
}

function realmEvaluate(self, x, endowments = {}) {
  // todo: don't pass in primal-realm objects like {}, for safety. OTOH its
  // properties are copied onto the new global 'target'.
  // todo: figure out a way to membrane away the contents to safety.
  const { safeEvalWhichTakesEndowments } = getRealmRecForRealmInstance(self);
  return safeEvalWhichTakesEndowments(x, endowments);
}

const BaseRealm = {
  initRootRealm,
  initCompartment,
  getRealmGlobal,
  realmEvaluate
};

// Define Realm onto new sharedGlobalDescs, so it can be defined in the
// safeGlobal like the rest of the shared globals.
function createRealmGlobalObject(unsafeRec) {
  const Realm = createRealmFacade(unsafeRec, BaseRealm);
  unsafeRec.sharedGlobalDescs.Realm = {
    value: Realm,
    writable: true,
    configurable: true
  };
  return Realm;
}

// Create the current unsafeRec from the current "primal" realm (the realm
// where the Realm shim is loaded and executed).
const currentUnsafeRec = createCurrentUnsafeRec();
const Realm = createRealmFacade(currentUnsafeRec, BaseRealm);

export default Realm;
