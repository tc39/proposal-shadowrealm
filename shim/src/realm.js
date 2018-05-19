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

function getCurrentRealmRecord() {
  const context = getCurrentContext();
  if (RealmRecord in context) {
    return context[RealmRecord];
  }
  const sandbox = createSandbox(context);
  const realmRec = {
    [Intrinsics]: getIntrinsics(sandbox),
    [GlobalObject]: sandbox.unsafeGlobal,
    [ShimSandbox]: sandbox
  };
  context[RealmRecord] = realmRec;
  return realmRec;
}

function portRealmConstructor(sandbox) {
  const { unsafeFunction, unsafeGlobal } = sandbox;

  // Rebuild a Realm class using inrinsics from the sandbox,
  // to prevent the Realm parts from breaking identity
  // continuity. This avoids loading the Ream shim in
  // every root realm.

  // This process is simplified becuase all methods
  // and properties on a realm instance already return
  // values based on the intrinsics of the realm.

  const sub = unsafeFunction('base', `
function Realm() {
  base.apply(this, arguments);
}
const descs = Object.getOwnPropertyDescriptors(base.prototype);
Object.defineProperties(Realm.prototype, {
  intrinsics: {
    get() {
      return descs.intrinsics.get.apply(this);
    }
  },
  global: {
    get() {
      return descs.global.get.apply(this);
    }
  },
  eval: {
    value() {
      return descs.eval.value.apply(this, arguments);
    }
  }
});
return Realm;
`)(Realm);

  defineProperties(unsafeGlobal, {
    Realm: {
        value: sub
    }
  });
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

export default function Realm(options) {
  const O = this;
  const opts = Object(options);

  // Limitation: the evaluators are tied to a sandbox,
  // and can't be completely abstracted from the inrinsics
  // of that sandbox. We impose in the shim the restriction
  // that intinsics must match the evaluator, and can't be
  // provided independently.

  if ('evaluator' in opts) {
    throw new TypeError('Realm does not support "evaluator" option.');
  }

  let sandbox;
  let intrinsics = opts.intrinsics;
  if (intrinsics === 'inherit') {
    // In "inherit" mode, we create a compartment realm and inherit
    // the sandbox since we share the intrinsics. We create a new
    // set to allow us to define eval() anf Function() for the realm.
    const parentRealm = getCurrentRealmRecord();
    sandbox = parentRealm[ShimSandbox];
    intrinsics = assign({}, parentRealm[Intrinsics]);

  } else if (intrinsics === undefined) {
    // When intrinics are not provided, we create a root realm
    // using the fresh set of new intrinics from a new sandbox.
    sandbox = createSandbox();
    portRealmConstructor(sandbox);
    intrinsics = getIntrinsics(sandbox);

  } else {
    throw new TypeError('Realm only supports undefined or "inherited" intrinsics.');
  }

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

