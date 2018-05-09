import { createSandbox, setSandboxGlobalObject } from './sandbox';
import { evaluate } from './evaluate';
import { getStdLib } from './stdlib';
import { getIntrinsics } from './intrinsics';
import { assert, IsCallable } from './utils';
import { defineProperties, create } from './commons';

const RealmRecord = Symbol('Realm Slot');
const Intrinsics = Symbol('Intrinsics Slot');
const GlobalObject = Symbol('GlobalObject Slot');
const GlobalThisValue = Symbol('GlobalThisValue Slot');
const GlobalEnv = Symbol('GlobalEnv Slot');
const EvalHook = Symbol('EvalHook Slot');
const IsDirectEvalHook = Symbol('IsDirectEvalHook Slot');
const ImportHook = Symbol('ImportHook Slot');
const ImportMetaHook = Symbol('ImportMetaHook Slot');
const ShimSandbox = Symbol('Sandbox');

// shim specific
function getSandbox(realmRec) {
  const sandbox = realmRec[ShimSandbox];
  assert(typeof sandbox === 'object');
  return sandbox;
}

function getCurrentRealmRecord() {
  let realmRec = window[RealmRecord];
  if (!realmRec) {
    // this is an outer realm, and we should set up the RealmRecord
    window[RealmRecord] = {
      // TODO: mimic what the global realm record should have
      // including default hooks, etc.
    };
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
    globalObj = create(intrinsics['ObjectPrototype']);
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
  // For each property of the Global Object specified in clause <emu-xref href="#sec-global-object"></emu-xref>, do
  // ---> diverging:
  const GlobalObjectDescriptors = getStdLib(realmRec[ShimSandbox]);
  defineProperties(global, GlobalObjectDescriptors);
  return global;
}

// <!-- es6num="8.2.2" -->
function CreateIntrinsics(realmRec) {
  // ---> diverging
  let intrinsics = getIntrinsics(realmRec[ShimSandbox]);
  realmRec[Intrinsics] = intrinsics;
  return intrinsics;
}

function CreateRealmRec(intrinsics) {
  let realmRec = /* new Realm Record from table-21 */ {
    [Intrinsics]: {},
    [GlobalObject]: undefined,
    [GlobalEnv]: undefined,
    // [TemplateMap]: [],
    // [HostDefined]: undefined,
    [EvalHook]: undefined,
    [IsDirectEvalHook]: undefined,
    [ImportHook]: undefined,
    [ImportMetaHook]: undefined,
    // ---> diverging to create the internal shim iframe
    [ShimSandbox]: createSandbox()
  };
  if (intrinsics === undefined) {
    CreateIntrinsics(realmRec);
  } else {
    // 1. Assert: In this case, _intrinsics_ must be a Record with field names listed in column one of Table 7.
    realmRec[Intrinsics] = intrinsics;
  }
  return realmRec;
}

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
  // realm spec segment begins
  if (direct === true) {
    x = InvokeDirectEvalHook(x, evalRealm);
  }
  // realm spec segment ends
  if (typeof x !== 'string') return x;
  // ---> diverging
  const sandbox = getSandbox(evalRealm);
  return evaluate(x, sandbox);
}

export default class Realm {
  constructor(options) {
    const O = this;
    const parentRealm = getCurrentRealmRecord();
    const opts = Object(options);
    let importHook = opts.importHook;
    if (importHook === 'inherit') {
      importHook = parentRealm[ImportHook];
    } else if (importHook !== undefined && IsCallable(importHook) === false) throw new TypeError();
    let importMetaHook = opts.importMetaHook;
    if (importMetaHook === 'inherit') {
      importMetaHook = parentRealm[ImportMetaHook];
    } else if (importMetaHook !== undefined && IsCallable(importMetaHook) === false)
      throw new TypeError();
    let evalHook = opts.evalHook;
    if (evalHook === 'inherit') {
      evalHook = parentRealm[EvalHook];
    } else if (evalHook !== undefined && IsCallable(evalHook) === false) throw new TypeError();
    let isDirectEvalHook = opts.isDirectEvalHook;
    if (isDirectEvalHook === 'inherit') {
      isDirectEvalHook = parentRealm[IsDirectEvalHook];
    } else if (isDirectEvalHook !== undefined && IsCallable(isDirectEvalHook) === false)
      throw new TypeError();
    let intrinsics = opts.intrinsics;
    if (intrinsics === 'inherit') {
      intrinsics = parentRealm[Intrinsics];
    } else if (intrinsics !== undefined) throw new TypeError();
    let thisValue = opts.thisValue;
    if (thisValue !== undefined && typeof thisValue !== 'object') throw new TypeError();
    const realmRec = CreateRealmRec(intrinsics);
    O[RealmRecord] = realmRec;
    SetRealmGlobalObject(realmRec, undefined, thisValue);
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
    let init = O.init;
    if (!IsCallable(init)) throw new TypeError();
    init.call(O);
    // ---> diverging
    setSandboxGlobalObject(
      realmRec[ShimSandbox],
      realmRec[GlobalObject],
      realmRec[GlobalEnv][GlobalThisValue]
    );
  }

  init() {
    let O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    SetDefaultGlobalBindings(O[RealmRecord]);
  }

  eval(x) {
    let O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    let evalRealm = O[RealmRecord];
    // HostEnsureCanCompileStrings(the current Realm Record, _evalRealm_).
    return PerformEval(x, evalRealm, false, false);
  }

  get stdlib() {
    let O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    // TODO: align with spec
    const sandbox = getSandbox(O[RealmRecord]);
    return getStdLib(sandbox);
  }

  get intrinsics() {
    let O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    // TODO: align with spec
    const sandbox = getSandbox(O[RealmRecord]);
    return getIntrinsics(sandbox.confinedWindow);
  }

  get global() {
    let O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    return O[RealmRecord][GlobalObject];
  }

  get thisValue() {
    let O = this;
    if (typeof O !== 'object') throw new TypeError();
    if (!(RealmRecord in O)) throw new TypeError();
    let envRec = O[RealmRecord][GlobalEnv];
    return envRec[GlobalThisValue];
  }
}

Realm.toString = () => 'function Realm() { [shim code] }';
