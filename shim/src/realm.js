import { createSandbox } from './sandbox';
import { createEvalEvaluator, createFunctionEvaluator } from './evaluators';
import { getStdLib } from './stdlib';
import { getIntrinsics } from './intrinsics';
import { assert, IsCallable } from './utils';
import { assign, create, defineProperties } from './commons';

import {
  RealmRecord,
  Intrinsics,
  GlobalObject,
  GlobalThisValue,
  GlobalEnv,
  EvalHook,
  IsDirectEvalHook,
  ImportHook,
  ImportMetaHook,
  ShimSandbox
} from './slots';

// shim specific
function getSandbox(realmRec) {
  const sandbox = realmRec[ShimSandbox];
  assert(typeof sandbox === 'object');
  return sandbox;
}

// shim specific
function getExecutionContext() {
  // eslint-disable-next-line no-new-func
  return new Function('return this')();
}

// shim specific
function getCurrentRealmRecord() {
  const context = getExecutionContext();
  let realmRec = context[RealmRecord];
  if (realmRec === undefined) {
    // If there is no realm slot, then we are outside of a realm shim,
    // and we emulate what the current realm record should be. This is
    // a root realm and we define all fields based on the context.
    const sandbox = createSandbox(context);
    realmRec = {
      [Intrinsics]: getIntrinsics(sandbox.unsafeGlobal),
      [GlobalObject]: sandbox.unsafeGlobal,
      [EvalHook]: sandbox.unsafeEval,
      [ShimSandbox]: sandbox
    };
    // Setup the RealmRecord for the next execution.
    context[RealmRecord] = realmRec;
  }
  return realmRec;
}

// <!-- es6num="8.1.2.5" -->
function NewGlobalEnvironment(G, thisValue) {
  // diverging from spec to accomodate the iframe as the lexical environment
  // using a class for better debugability
  class EnvironmentRecord {
    constructor(/*globalObject*/) {
      this[GlobalThisValue] = thisValue;
    }
  }
  return new EnvironmentRecord(G);
}

// <!-- es6num="8.2.3" -->
function SetRealmGlobalObject(realmRec, globalObj, thisValue) {
  if (globalObj === undefined) {
    const intrinsics = realmRec[Intrinsics];
    globalObj = create(intrinsics.ObjectPrototype);
  }
  assert(typeof globalObj === 'object');
  if (thisValue === undefined) thisValue = globalObj;
  realmRec[GlobalObject] = globalObj;
  const newGlobalEnv = NewGlobalEnvironment(globalObj, thisValue);
  realmRec[GlobalEnv] = newGlobalEnv;
  return realmRec;
}

// <!-- es6num="8.2.4" -->
function SetDefaultGlobalBindings(realmRec) {
  const global = realmRec[GlobalObject];
  // For each property of the Global Object specified in clause 18, do
  // ---> diverging
  const intrinsics = realmRec[Intrinsics];
  const descs = getStdLib(intrinsics);
  defineProperties(global, descs);
  // <--- diverging
  return global;
}

// <!-- es6num="8.2.2" -->
function CreateIntrinsics(realmRec) {
  // ---> diverging
  const sandbox = getSandbox(realmRec);
  const intrinsics = getIntrinsics(sandbox.unsafeGlobal);
  // <--- diverging
  realmRec[Intrinsics] = intrinsics;
  return intrinsics;
}

// <!-- proposal="11.1.1" -->
// <!-- deprecates es6num="8.2.1" -->
function CreateRealmRec(intrinsics, /* shim specific */ sandbox) {
  const realmRec = {
    // ES specs table-21
    [Intrinsics]: {},
    [GlobalObject]: undefined,
    [GlobalEnv]: undefined,
    // [TemplateMap]: [],
    // [HostDefined]: undefined,

    // Realm specs table-2
    [EvalHook]: undefined,
    [IsDirectEvalHook]: undefined,
    [ImportHook]: undefined,
    [ImportMetaHook]: undefined,

    // ---> diverging
    [ShimSandbox]: sandbox
    // <--- diverging
  };
  if (intrinsics === undefined) {
    CreateIntrinsics(realmRec);
  } else {
    // 1. Assert: In this case, _intrinsics_ must be a Record with field names listed in column one of Table 7.
    realmRec[Intrinsics] = intrinsics;
  }
  return realmRec;
}

// <!-- proposal="1.2" -->
function InvokeDirectEvalHook(realmRec, x) {
  // 1. Assert: realm is a Realm Record.
  const fn = realmRec[EvalHook];
  if (fn === undefined) return x;
  assert(IsCallable(fn) === true);
  return fn.call(undefined, x);
}

// <!-- es6num="18.2.1.1" -->
function PerformEval(x, evalRealm, strictCaller, direct) {
  assert(direct === false ? strictCaller === false : true);
  if (typeof x !== 'string') return x;
  // ---> diverging
  if (direct === true) {
    x = InvokeDirectEvalHook(x, evalRealm);
  }
  return evalRealm[EvalHook](x);
}

// <!-- proposal="11.3.1" -->
export default class Realm {
  constructor(options) {
    const O = this;
    const parentRealm = getCurrentRealmRecord();
    const opts = Object(options);

    let importHook = opts.importHook;
    if (importHook === 'inherit') {
      importHook = parentRealm[ImportHook];
    } else if (importHook !== undefined && IsCallable(importHook) === false) {
      throw new TypeError();
    }

    let importMetaHook = opts.importMetaHook;
    if (importMetaHook === 'inherit') {
      importMetaHook = parentRealm[ImportMetaHook];
    } else if (importMetaHook !== undefined && IsCallable(importMetaHook) === false) {
      throw new TypeError();
    }

    let evalHook = opts.evalHook;
    if (evalHook === 'inherit') {
      evalHook = parentRealm[EvalHook];
    } else if (evalHook !== undefined && IsCallable(evalHook) === false) {
      throw new TypeError();
    }

    let isDirectEvalHook = opts.isDirectEvalHook;
    if (isDirectEvalHook === 'inherit') {
      isDirectEvalHook = parentRealm[IsDirectEvalHook];
    } else if (isDirectEvalHook !== undefined && IsCallable(isDirectEvalHook) === false) {
      throw new TypeError();
    }

    // ---> diverging
    // Limitation: intrisics and sandbox must always match. We
    // known this early during the constuction of the realm.
    let intrinsics = opts.intrinsics;
    let sandbox;
    if (intrinsics === 'inherit') {
      // When we inherit the intrinsics, we also must
      // inherit the sandbox.
      intrinsics = parentRealm[Intrinsics];
      sandbox = parentRealm[ShimSandbox];
    } else if (intrinsics === undefined) {
      // When intrinics are not specified, we
      // need to create a sandbox.
      sandbox = createSandbox();
    } else {
      throw new TypeError();
    }
    // <--- diverging

    const thisValue = opts.thisValue;
    if (thisValue !== undefined && typeof thisValue !== 'object') {
      throw new TypeError();
    }

    const realmRec = CreateRealmRec(intrinsics, sandbox);
    O[RealmRecord] = realmRec;

    SetRealmGlobalObject(realmRec, undefined, thisValue);
    // ---> diverging
    // Limitation: the evaluators are tied to a global object and
    // need to be created after the global object. It is process
    // also updates the intrinsics.
    createEvalEvaluator(realmRec);
    createFunctionEvaluator(realmRec);
    // <--- diverging

    if (importHook === undefined) {
      // new built-in function object as defined in <emu-xref href="#sec-realm-default-import-hook-functions"></emu-xref>
      importHook = function(/*referrer, specifier*/) {
        throw new TypeError();
      };
    }
    realmRec[ImportHook] = importHook;
    if (evalHook !== undefined) {
      realmRec[EvalHook] = evalHook;
    }
    if (isDirectEvalHook !== undefined) {
      realmRec[IsDirectEvalHook] = isDirectEvalHook;
    }

    const init = O.init;
    if (!IsCallable(init)) throw new TypeError();
    init.call(O);
  }

  init() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    SetDefaultGlobalBindings(O[RealmRecord]);
  }

  eval(x) {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    const evalRealm = O[RealmRecord];
    // HostEnsureCanCompileStrings(the current Realm Record, _evalRealm_).
    return PerformEval(x, evalRealm, false, false);
  }

  get stdlib() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    // TODO: align with spec
    const intrinsics = O[RealmRecord][Intrinsics];
    return getStdLib(intrinsics);
  }

  get intrinsics() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    // TODO: align with spec
    const intrinsics = O[RealmRecord][Intrinsics];
    return assign({}, intrinsics);
  }

  get global() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    return O[RealmRecord][GlobalObject];
  }

  get thisValue() {
    const O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    const envRec = O[RealmRecord][GlobalEnv];
    return envRec[GlobalThisValue];
  }
}

Realm.toString = () => 'function Realm() { [shim code] }';
