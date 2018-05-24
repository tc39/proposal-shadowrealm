import { createContextRec, getCurrentContextRec } from './context';
import { getDirectEvalEvaluator, getFunctionEvaluator } from './evaluators';
import { getStdLib } from './stdlib';
import { getIntrinsics } from './intrinsics';
import { tamperProofDataProperties } from './tamper-proof';
import { deepFreeze } from './deep-freeze';
import { IsCallable } from './utils';
import { assign, create, defineProperty, defineProperties, getPrototypeOf } from './commons';
import { Intrinsics, GlobalObject, IsDirectEvalTrap, ContextRec } from './symbols';

const Realm2RealmRec = new WeakMap();
const RealmProto2ContextRec = new WeakMap();

function createRealmFacade(contextRec, BaseRealm) {
  const { contextFunction, contextGlobal } = contextRec;

  // The BaseRealm is the Realm class created by
  // the shim. It's only valid for the context where
  // it was parsed.

  // The Realm facade is a lightwwight class built in the
  // context a different context, that provide a fully
  // functional Realm class using the intrisics
  // of that context.

  // This process is simplified becuase all methods
  // and properties on a realm instance already return
  // values using the intrinsics of the realm's context.

  // Invoke the BaseRealm constructor with Realm as the prototype.
  const Realm = contextFunction(
    'BaseRealm',
    `

const descs = Object.getOwnPropertyDescriptors(BaseRealm.prototype);

class Realm {
  constructor(options) {
    return Reflect.construct(BaseRealm, arguments, Realm);
  }
  init() {
    descs.init.value.apply(this);
  }
  get intrinsics() {
    return descs.intrinsics.get.apply(this);
  }
  get global() {
    return descs.global.get.apply(this);
  }
  evaluate(x) {
    return descs.evaluate.value.apply(this, arguments);
  }
}

Object.defineProperty(Realm.prototype, Symbol.toStringTag, {
  value: 'function Realm() { [shim code] }',
  writable: false,
  enumerable: false,
  configurable: true
});

return Realm;

  `
  )(BaseRealm);

  contextGlobal.Realm = Realm;
  RealmProto2ContextRec.set(Realm.prototype, contextRec);
}

function getGlobaObject(intrinsics) {
  return create(intrinsics.ObjectPrototype);
}

function createEvaluators(realmRec) {
  // Divergence from specifications: the evaluators are tied to
  // a global and they are tied to a realm and to the intrinsics
  // of that realm.
  const directEvalEvaluator = getDirectEvalEvaluator(realmRec);
  const functionEvaluator = getFunctionEvaluator(realmRec);

  // Limitation: export a direct evaluator.
  const intrinsics = realmRec[Intrinsics];
  intrinsics.eval = directEvalEvaluator;
  intrinsics.Function = functionEvaluator;

  realmRec[IsDirectEvalTrap] = directEvalEvaluator;
}

function setDefaultBindings(realmRec) {
  const intrinsics = realmRec[Intrinsics];
  const descs = getStdLib(intrinsics);
  defineProperties(realmRec[GlobalObject], descs);
}

export default class Realm {
  constructor(options) {
    const O = this;
    options = Object(options); // Todo: sanitize

    let contextRec;
    if (options.intrinsics === 'inherit') {
      // In "inherit" mode, we create a compartment realm and inherit
      // the context since we share the intrinsics. We create a new
      // set to allow us to define eval() anf Function() for the realm.
      contextRec = RealmProto2ContextRec.get(getPrototypeOf(this));
    } else if (options.intrinsics === undefined) {
      // When intrinics are not provided, we create a root realm
      // using the fresh set of new intrinics from a new context.
      contextRec = createContextRec();
      createRealmFacade(contextRec, Realm);
    } else {
      throw new TypeError('Realm only supports undefined or "inherited" intrinsics.');
    }
    const intrinsics = getIntrinsics(contextRec);
    const globalObj = getGlobaObject(intrinsics);

    const realmRec = {
      [ContextRec]: contextRec,
      [Intrinsics]: intrinsics,
      [GlobalObject]: globalObj,
      [IsDirectEvalTrap]: undefined
    };
    Realm2RealmRec.set(O, realmRec);

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
    const evaluator = realmRec[IsDirectEvalTrap];
    return evaluator(x);
  }
  // This is a temporary addition, currenly being evaluated.
  freeze() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!Realm2RealmRec.has(O)) throw new TypeError();
    const realmRec = Realm2RealmRec.get(O);

    // Copy the intrinsics into a plain object to avoid
    // freezing the object itself.
    const obj = create(null);
    const intrinsics = realmRec[Intrinsics];
    assign(obj, intrinsics);
    tamperProofDataProperties(obj);
    deepFreeze(obj);
  }
}

RealmProto2ContextRec.set(Realm.prototype, getCurrentContextRec());

defineProperty(Realm.prototype, Symbol.toStringTag, {
  value: 'function Realm() { [shim code] }',
  writable: false,
  enumerable: false,
  configurable: true
});
