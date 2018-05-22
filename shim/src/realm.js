import { createSandbox } from './sandbox';
import { getDirectEvalEvaluator, getFunctionEvaluator } from './evaluators';
import { getStdLib } from './stdlib';
import { getIntrinsics } from './intrinsics';
import { IsCallable } from './utils';

import { assign, create, defineProperties, getPrototypeOf } from './commons';

import { Intrinsics, GlobalObject, DirectEvalEvaluator, ShimSandbox } from './symbols';

const Realm2RealmRec = new WeakMap();
const RealmProto2Sandbox = new WeakMap();

function getCurrentContext() {
  // eslint-disable-next-line no-new-func
  return new Function('return this')();
}

function getCurrentSandbox() {
  const context = getCurrentContext();
  const sandbox = createSandbox(context);
  return sandbox;
}

function createRealmFacade(sandbox, BaseRealm) {
  const { unsafeFunction, unsafeGlobal } = sandbox;

  // The BaseRealm is the Realm class created by
  // the shim. It's only valid for the context where
  // it was parsed.

  // The Realm facade is a lightwwight class built in the
  // context a different sandbox, that provide a fully
  // functional Realm class using the intrisics
  // of that sandbox.

  // This process is simplified becuase all methods
  // and properties on a realm instance already return
  // values using the intrinsics of the realm's sandbox.

  const Realm = unsafeFunction(
    'BaseRealm',
    `

const descs = Object.getOwnPropertyDescriptors(BaseRealm.prototype);

class Realm {
  constructor(options) {
    // Invoke the BaseRealm constructor with Realm as the prototype.
    return Reflect.construct(BaseRealm, [options], Realm);
  }
  init() {
    descs.init.value.call(this);
  }
  intrinsics() {
    return descs.intrinsics.get.call(this);
  }
  global() {
    return descs.global.get.call(this);
  }
  evaluate(x) {
    return descs.evaluate.value.call(this, x);
  }
}

Realm.toString = () => 'function Realm() { [shim code] }';

return Realm;

  `
  )(BaseRealm);

  unsafeGlobal.Realm = Realm;
  RealmProto2Sandbox.set(Realm.prototype, sandbox);
}

function setGlobaObject(realmRec) {
  const intrinsics = realmRec[Intrinsics];
  const globalObj = create(intrinsics.ObjectPrototype);
  realmRec[GlobalObject] = globalObj;
}

function createEvaluators(realmRec) {
  // Divergence from specifications: the evaluators are tied to
  // a global and they are tied to a realm and to the intrinsics
  // of that realm.
  const directEvalEvaluator = getDirectEvalEvaluator(realmRec);
  const FunctionEvaluator = getFunctionEvaluator(realmRec);

  // No need to store Function.
  realmRec[DirectEvalEvaluator] = directEvalEvaluator;

  // Limitation: export a direct evaluator.
  const intrinsics = realmRec[Intrinsics];
  intrinsics.eval = directEvalEvaluator;
  intrinsics.Function = FunctionEvaluator;
}

function setDefaultBindings(realmRec) {
  const intrinsics = realmRec[Intrinsics];
  const descs = getStdLib(intrinsics);
  defineProperties(realmRec[GlobalObject], descs);
}

export default class Realm {
  constructor(options) {
    const O = this;
    const opts = Object(options);

    let sandbox;
    let intrinsics = opts.intrinsics;
    if (intrinsics === 'inherit') {
      // In "inherit" mode, we create a compartment realm and inherit
      // the sandbox since we share the intrinsics. We create a new
      // set to allow us to define eval() anf Function() for the realm.
      sandbox = RealmProto2Sandbox.get(getPrototypeOf(this));
    } else if (intrinsics === undefined) {
      // When intrinics are not provided, we create a root realm
      // using the fresh set of new intrinics from a new sandbox.
      sandbox = createSandbox();
      createRealmFacade(sandbox, Realm);
    } else {
      throw new TypeError('Realm only supports undefined or "inherited" intrinsics.');
    }
    intrinsics = getIntrinsics(sandbox);

    const realmRec = {
      [ShimSandbox]: sandbox,
      [Intrinsics]: intrinsics,
      [GlobalObject]: undefined,
      [DirectEvalEvaluator]: undefined
    };
    Realm2RealmRec.set(O, realmRec);

    setGlobaObject(realmRec);

    const init = O.init;
    if (!IsCallable(init)) throw new TypeError();
    init.call(O);
  }
  init() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!Realm2RealmRec.has(O)) throw new TypeError();
    const realmRec = Realm2RealmRec.get(O);
    createEvaluators(realmRec);
    setDefaultBindings(realmRec);
  }
  get intrinsics() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!Realm2RealmRec.has(O)) throw new TypeError();
    const realmRec = Realm2RealmRec.get(O);
    const intrinsics = realmRec[Intrinsics];
    // The object returned has its prototype
    // match the ObjectPrototype of the realm.
    const obj = create(intrinsics.ObjectPrototype);
    return assign(obj, intrinsics);
  }
  get global() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!Realm2RealmRec.has(O)) throw new TypeError();
    const realmRec = Realm2RealmRec.get(O);
    return realmRec[GlobalObject];
  }
  evaluate(x) {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!Realm2RealmRec.has(O)) throw new TypeError();
    const realmRec = Realm2RealmRec.get(O);
    const evaluator = realmRec[DirectEvalEvaluator];
    return evaluator(x);
  }
}

Realm.toString = () => 'function Realm() { [shim code] }';

// The current sandbox is the sandbox where the
// Realm shim is being parsed and executed.
RealmProto2Sandbox.set(Realm.prototype, getCurrentSandbox());
