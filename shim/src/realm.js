import { createRealmFacade, buildChildRealm } from './realmFacade';
import { createNewUnsafeRec, createCurrentUnsafeRec } from './unsafeRec';
import {
  createSafeEvaluatorFactory,
  createSafeEvaluator,
  createSafeEvaluatorWhichTakesEndowments,
  createFunctionEvaluator
} from './evaluators';
import { assert } from './utilities';
import { create, defineProperties, freeze, arrayConcat } from './commons';

// Mimic private members on the realm instances.
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

/**
 * A root realm uses a fresh set of new intrinics. Here we first create
 * a new unsafe record, which inherits the shims. Then we proceed with
 * the creation of the realm record, and we apply the shims.
 */
function initRootRealm(parentUnsafeRec, self, options) {
  // note: 'self' is the instance of the Realm.

  // todo: investigate attacks via Array.species
  // todo: this accepts newShims='string', but it should reject that
  const { shims: newShims } = options;
  const allShims = arrayConcat(parentUnsafeRec.allShims, newShims);

  // The unsafe record is created already repaired.
  const unsafeRec = createNewUnsafeRec(allShims);

  // eslint-disable-next-line no-use-before-define
  const Realm = createRealmFacade(unsafeRec, BaseRealm);

  // Add a Realm descriptor to sharedGlobalDescs, so it can be defined onto the
  // safeGlobal like the rest of the globals.
  unsafeRec.sharedGlobalDescs.Realm = {
    value: Realm,
    writable: true,
    configurable: true
  };

  // Create the realmRec is necessary to provide the global object, eval() and
  // Function() to the realm.
  const realmRec = createRealmRec(unsafeRec);

  // Apply all shims in the new RootRealm. We don't do this for compartments.
  const { safeEvalWhichTakesEndowments } = realmRec;
  for (const shim of allShims) {
    safeEvalWhichTakesEndowments(shim);
  }

  // The realmRec acts as a private field on the realm instance.
  registerRealmRecForRealmInstance(self, realmRec);
}

/**
 * A compartment shares the intrinsics of its root realm. Here, only a
 * realmRec is necessary to hold the global object, eval() and Function().
 */
function initCompartment(unsafeRec, self) {
  // note: 'self' is the instance of the Realm.

  const realmRec = createRealmRec(unsafeRec);

  // The realmRec acts as a private field on the realm instance.
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

// Create the current unsafeRec from the current "primal" environment (the realm
// where the Realm shim is loaded and executed).
const currentUnsafeRec = createCurrentUnsafeRec();

/**
 * The "primal" realm class is defined in the current "primal" environment,
 * and is part of the shim. There is no need to acade this class via evaluation
 * because they share the same intrinsics.
 */
const Realm = buildChildRealm(currentUnsafeRec, BaseRealm);

export default Realm;
