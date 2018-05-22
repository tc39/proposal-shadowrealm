import { createSandbox } from './sandbox';
import { getDirectEvalEvaluator, getFunctionEvaluator } from './evaluators';
import { getStdLib } from './stdlib';
import { getIntrinsics } from './intrinsics';
import { assert, IsCallable } from './utils';
import { assign, create, defineProperties } from './commons';

import {
  RealmRecord,
  Intrinsics,
  GlobalObject,
  DirectEvalEvaluator,
  ShimSandbox
} from './symbols';

function getCurrentContext() {
  // eslint-disable-next-line no-new-func
  return new Function('return this')();
}

function getCurrentSandbox() {
  const context = getCurrentContext()
  const sandbox = createSandbox(context);
  return sandbox;
}

function createRealmFacade(sandbox) {
  const { unsafeFunction, unsafeGlobal } = sandbox;

  // Rebuild a Realm class using inrinsics from the sandbox,
  // to prevent the Realm parts from breaking identity
  // continuity. This avoids loading the Ream shim in
  // every root realm.

  // This process is simplified becuase all methods
  // and properties on a realm instance already return
  // values based on the intrinsics of the realm.

  unsafeGlobal.Realm = unsafeFunction('base', 'ShimSandbox', 'sandbox', `

function Realm(options) {
  this[ShimSandbox] = sandbox;
  base.call(this, options);
}

const descs = Object.getOwnPropertyDescriptors(base.prototype);

Object.defineProperties(Realm.prototype, {
  intrinsics: {
    get() {
      return descs.intrinsics.get.call(this);
    }
  },
  global: {
    get() {
      return descs.global.get.call(this);
    }
  },
  eval: {
    value(x) {
      return descs.eval.value.call(this, x);
    }
  }
});

Realm.toString = () => base.toString();

return Realm;

  `)(Realm, ShimSandbox, sandbox);

}

function setGlobaObject(realmRec) {
  const intrinsics = realmRec[Intrinsics];
  const globalObj = create(intrinsics.ObjectPrototype);
  globalObj[RealmRecord] = realmRec;
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
  const intrinsics = realmRec[Intrinsics]
  const descs = getStdLib(intrinsics);
  defineProperties(realmRec[GlobalObject], descs);
}

// The current sandbox is the sandbox where the
// Realm shim is being parsed and executed.
const currentSandbox = getCurrentSandbox();

export default function Realm(options) {
  const O = this;
  const opts = Object(options);

  let sandbox;
  let intrinsics = opts.intrinsics;
  if (intrinsics === 'inherit') {
    // In "inherit" mode, we create a compartment realm and inherit
    // the sandbox since we share the intrinsics. We create a new
    // set to allow us to define eval() anf Function() for the realm.
    if (ShimSandbox in O) {
      sandbox = O[ShimSandbox]
    } else {
      sandbox = currentSandbox;
    }

  } else if (intrinsics === undefined) {
    // When intrinics are not provided, we create a root realm
    // using the fresh set of new intrinics from a new sandbox.
    sandbox = createSandbox();
    createRealmFacade(sandbox);

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

  setGlobaObject(realmRec);
  createEvaluators(realmRec);
  setDefaultBindings(realmRec);

  O[RealmRecord] = realmRec;
}

defineProperties(Realm.prototype, {
  intrinsics: {
    get() {
      const O = this;
      if (typeof O !== 'object') throw new TypeError();
      if (!(RealmRecord in O)) throw new TypeError();
      const intrinsics = O[RealmRecord][Intrinsics];
      // The object returned has its prototype
      // match the ObjectPrototype of the realm.
      const obj = create(intrinsics.ObjectPrototype);
      return assign(obj, intrinsics);
    }
  },
  global: {
    get() {
      const O = this;
      if (typeof O !== 'object') throw new TypeError();
      if (!(RealmRecord in O)) throw new TypeError();
      return O[RealmRecord][GlobalObject];
    }
  },
  eval: {
    value(x) {
      const O = this;
      if (typeof O !== 'object') throw new TypeError();
      if (!(RealmRecord in O)) throw new TypeError();
      const realmRec = O[RealmRecord];
      const evaluator = realmRec[DirectEvalEvaluator]
      return evaluator(x);
    }
  }
});

Realm.toString = () => 'function Realm() { [shim code] }';
