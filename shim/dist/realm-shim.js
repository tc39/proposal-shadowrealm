(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.RealmShim = factory());
}(this, (function () { 'use strict';

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

  // Declare shorthand functions. Sharing these declarations accross modules
  // improves both consitency and minification. Unused declarations are dropped
  // by the tree shaking process.

  const {
    assign,
    create,
    defineProperties,
    freeze,
    getOwnPropertyDescriptors,
    getOwnPropertyNames
  } = Object;

  const {
    apply,
    defineProperty,
    deleteProperty,
    getOwnPropertyDescriptor,
    getPrototypeOf,
    ownKeys,
    setPrototypeOf
  } = Reflect;

  class Handler {
    constructor(sandbox) {
      const { unsafeGlobal } = sandbox;
      this.unsafeGlobal = unsafeGlobal;

      // this flag allow us to determine if the eval() call is a controlled
      // eval done by the realm's code or if it is user-land invocation, so
      // we can react differently.
      this.isInternalEvaluation = false;
    }

    get(target, prop) {
      // Special treatment for eval.
      if (prop === 'eval') {
        if (this.isInternalEvaluation) {
          this.isInternalEvaluation = false;
          return this.unsafeGlobal.eval;
        }
        return target.eval;
      }
      // Properties of global.
      if (prop in target) {
        return target[prop];
      }
      // Prevent the lookup for other properties.
      return undefined;
    }

    has(target, prop) {
      if (prop === 'eval') {
        return true;
      }
      if (prop === 'arguments') {
        return false;
      }
      if (prop in target) {
        return true;
      }
      if (prop in this.unsafeGlobal) {
        return true;
      }
      return false;
    }
  }

  // Portions adapted from V8 - Copyright 2016 the V8 project authors.

  function createEvalEvaluatorFactory(sandbox) {
    const { unsafeFunction } = sandbox;

    return unsafeFunction(`
    with (arguments[0]) {
      return function() {
        'use strict';
        return eval(arguments[0]);
      };
    }
  `);
  }

  function createEvalEvaluator(realmRec) {
    const sandbox = realmRec[ShimSandbox];
    const globalObject = realmRec[GlobalObject];
    const intrinsics = realmRec[Intrinsics];

    // This proxy has several functions:
    // 1. works with the sentinel to alternate between direct eval and confined eval.
    // 2. shadows all properties of the hidden global by declaring them as undefined.
    // 3. resolves all existing properties of the sandboxed global.
    const handler = new Handler(sandbox);
    const proxy = new Proxy(globalObject, handler);

    const scopedEvaluator = sandbox.evalEvaluatorFactory(proxy);

    function evaluator(src) {
      handler.isInternalEvaluation = true;
      // Ensure that "this" resolves to the secure global.
      const result = scopedEvaluator.call(globalObject, src);
      handler.isInternalEvaluation = false;
      return result;
    }

    // Mimic the native eval() function. New properties are
    // by default non-writable and non-configurable.
    defineProperties(evaluator, {
      name: {
        value: 'eval'
      }
    });

    // This instance is realm-specific, and therefore doesn't
    // need to be frozen (only the objects reachable from it).

    // Once created for a realm, the reference must be updated everywhere.
    realmRec[EvalHook] = globalObject.eval = intrinsics.eval = evaluator;
  }

  /**
   * A safe version of the native Function which relies on
   * the safety of evalEvaluator for confinement.
   */
  function createFunctionEvaluator(realmRec) {
    const { unsafeFunction } = realmRec[ShimSandbox];
    const globalObject = realmRec[GlobalObject];
    const intrinsics = realmRec[Intrinsics];

    function evaluator(...params) {
      const functionBody = params.pop() || '';
      let functionParams = params.join(',');

      if (functionParams.includes(')')) {
        // If the formal parameters string include ) - an illegal
        // character - it may make the combined function expression
        // compile. We avoid this problem by checking for this early on.
        throw new Error('Function arg string contains parenthesis');
      }

      if (functionParams.length > 0) {
        // If the formal parameters include an unbalanced block comment, the
        // function must be rejected. Since JavaScript does not allow nested
        // comments we can include a trailing block comment to catch this.
        functionParams += '\n/*``*/';
      }

      const src = `(function(${functionParams}){\n${functionBody}\n})`;

      return intrinsics.eval(src);
    }

    // Ensure that the different Function instances of the different
    // sandboxes all answer properly when used with the instanceof
    // operator to preserve indentity.
    const FunctionPrototype = unsafeFunction.prototype;

    // Mimic the native signature. New properties are
    // by default non-writable and non-configurable.
    defineProperties(evaluator, {
      name: {
        value: 'Function'
      },
      prototype: {
        value: FunctionPrototype
      }
    });

    // This instance is namespace-specific, and therefore doesn't
    // need to be frozen (only the objects reachable from it).

    // Once created for a realm, the reference must be everywhere.
    globalObject.Function = intrinsics.Function = evaluator;
  }

  // Adapted from SES/Caja - Copyright (C) 2011 Google Inc.

  /**
   * Replace the legacy accessors of Object to comply with strict mode
   * and ES2016 semantics, we do this by redefining them while in 'use strict'
   * https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__
   */
  function repairAccessors(sandbox) {
    const { unsafeGlobal: g } = sandbox;

    defineProperties(g.Object.prototype, {
      __defineGetter__: {
        value(prop, func) {
          return defineProperty(this, prop, {
            get: func,
            enumerable: true,
            configurable: true
          });
        }
      },
      __defineSetter__: {
        value(prop, func) {
          return defineProperty(this, prop, {
            set: func,
            enumerable: true,
            configurable: true
          });
        }
      },
      __lookupGetter__: {
        value(prop) {
          let base = this;
          let desc;
          while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
            base = getPrototypeOf(base);
          }
          return desc && desc.get;
        }
      },
      __lookupSetter__: {
        value(prop) {
          let base = this;
          let desc;
          while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
            base = getPrototypeOf(base);
          }
          return desc && desc.set;
        }
      }
    });
  }

  // Adapted from SES/Caja

  /**
   * The process to repair constructors:
   * 1. Obtain the prototype from an instance
   * 2. Create a substitute noop constructor
   * 3. Replace its prototype property with the original prototype
   * 4. Replace its prototype property's constructor with itself
   * 5. Replace its [[Prototype]] slot with the noop constructor of Function
   */
  function repairFunction(sandbox, functionName, functionDecl) {
    const { unsafeEval, unsafeFunction } = sandbox;

    const FunctionInstance = unsafeEval(`(${functionDecl}(){})`);
    const FunctionPrototype = getPrototypeOf(FunctionInstance);

    // Block evaluation of source when calling constructor on the prototype of functions.
    const TamedFunction = unsafeFunction('throw new Error();');

    defineProperties(TamedFunction, {
      name: {
        value: functionName
      },
      prototype: {
        value: FunctionPrototype
      }
    });
    defineProperty(FunctionPrototype, 'constructor', { value: TamedFunction });

    // Prevent loop in case of Function.
    if (functionName !== 'Function') {
      setPrototypeOf(TamedFunction, unsafeFunction.prototype.constructor);
    }
  }

  /**
   * This block replaces the original Function constructor, and the original
   * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
   * safe replacements that preserve SES confinement. After this block is done,
   * the originals should no longer be reachable.
   */
  function repairFunctions(sandbox) {
    const { unsafeGlobal: g } = sandbox;
    const hasAsyncIteration = typeof g.Symbol.asyncIterator !== 'undefined';

    // Here, the order of operation is important: Function needs to be
    // repaired first since the other constructors need it.
    repairFunction(sandbox, 'Function', 'function');
    repairFunction(sandbox, 'GeneratorFunction', 'function*');
    repairFunction(sandbox, 'AsyncFunction', 'async function');
    if (hasAsyncIteration) {
      repairFunction(sandbox, 'AsyncGeneratorFunction', 'async function*');
    }
  }

  // Sanitizing ensures that neither the legacy
  // accessors nor the function constructors can be
  // used to escape the confinement of the evaluators
  // to execute in the sandbox.

  function sanitize(sandbox) {
    repairAccessors(sandbox);
    repairFunctions(sandbox);
  }

  // The sandbox is shim-specific. It acts as the mechanism
  // to obtain a fresh set of intrinsics together with their
  // associated eval and Function evaluators. This association
  // must be respected since the evaluators are imposing a
  // set of intrinsics, aka the "undeniables".

  function createContext() {
    const iframe = document.createElement('iframe');

    iframe.title = 'script';
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', true);

    document.body.appendChild(iframe);

    return iframe.contentWindow;
  }

  function createSandbox(context) {
    if (context === undefined) {
      context = createContext();
    }
    // The sandbox is entirely defined by these three objects.
    // Reusing the terminology from SES/Caja.
    const sandbox = {
      unsafeGlobal: context,
      unsafeEval: context.eval,
      unsafeFunction: context.Function
    };
    if (sandbox.evalEvaluatorFactory === undefined) {
      sandbox.evalEvaluatorFactory = createEvalEvaluatorFactory(sandbox);
    }
    sanitize(sandbox);
    return sandbox;
  }

  function getStdLib(intrinsics) {
    const i = intrinsics;

    return {
      // *** 18.1 Value Properties of the Global Object

      Infinity: { value: Infinity },
      NaN: { value: NaN },
      undefined: { value: undefined },

      // *** 18.2 Function Properties of the Global Object

      eval: { value: i.eval },
      isFinite: { value: i.isFinite },
      isNaN: { value: i.isNaN },
      parseFloat: { value: i.parseFloat },
      parseInt: { value: i.parseInt },

      decodeURI: { value: i.decodeURI },
      decodeURIComponent: { value: i.decodeURIComponent },
      encodeURI: { value: i.encodeURI },
      encodeURIComponent: { value: i.encodeURIComponent },

      // *** 18.3 Constructor Properties of the Global Object

      Array: { value: i.Array },
      ArrayBuffer: { value: i.ArrayBuffer },
      Boolean: { value: i.Boolean },
      DataView: { value: i.DataView },
      Date: { value: i.Date },
      Error: { value: i.Error },
      EvalError: { value: i.EvalError },
      Float32Array: { value: i.Float32Array },
      Float64Array: { value: i.Float64Array },
      Function: { value: i.Function },
      Int8Array: { value: i.Int8Array },
      Int16Array: { value: i.Int16Array },
      Int32Array: { value: i.Int32Array },
      Map: { value: i.Map },
      Number: { value: i.Number },
      Object: { value: i.Object },
      Promise: { value: i.Promise },
      Proxy: { value: i.Proxy },
      RangeError: { value: i.RangeError },
      ReferenceError: { value: i.ReferenceError },
      RegExp: { value: i.RegExp },
      Set: { value: i.Set },
      // SharedArrayBuffer - Deprecated on Jan 5, 2018
      String: { value: i.String },
      Symbol: { value: i.Symbol },
      SyntaxError: { value: i.SyntaxError },
      TypeError: { value: i.TypeError },
      Uint8Array: { value: i.Uint8Array },
      Uint8ClampedArray: { value: i.Uint8ClampedArray },
      Uint16Array: { value: i.Uint16Array },
      Uint32Array: { value: i.Uint32Array },
      URIError: { value: i.URIError },
      WeakMap: { value: i.WeakMap },
      WeakSet: { value: i.WeakSet },

      // *** 18.4 Other Properties of the Global Object

      Atomics: { value: i.Atomics },
      JSON: { value: i.JSON },
      Math: { value: i.Math },
      Reflect: { value: i.Reflect },

      // *** Annex B

      escape: { value: i.escape },
      unescape: { value: i.unescape },

      // *** ECMA-402

      Intl: { value: i.Intl },

      // *** ESNext

      Realm: { value: i.Realm }
    };
  }

  /**
   * Get the intrinsics from Table 7 & Annex B
   * Named intrinsics: available as data properties of the global object.
   * Anonymous intrinsics: not otherwise reachable by own property name traversal.
   *
   * https://tc39.github.io/ecma262/#table-7
   * https://tc39.github.io/ecma262/#table-73
   */
  function getIntrinsics(global) {
    const g = global;

    // Anonymous intrinsics.

    const SymbolIterator = g.Symbol.iterator;

    const ArrayIteratorInstance = new g.Array()[SymbolIterator]();
    const ArrayIteratorPrototype = getPrototypeOf(ArrayIteratorInstance);
    const IteratorPrototype = getPrototypeOf(ArrayIteratorPrototype);

    const AsyncFunctionInstance = g.eval('(async function(){})');
    const AsyncFunction = AsyncFunctionInstance.constructor;
    const AsyncFunctionPrototype = AsyncFunction.prototype;

    const GeneratorFunctionInstance = g.eval('(function*(){})');
    const GeneratorFunction = GeneratorFunctionInstance.constructor;
    const Generator = GeneratorFunction.prototype;
    const GeneratorPrototype = Generator.prototype;

    const hasAsyncIterator = typeof g.Symbol.asyncIterator !== 'undefined';

    const AsyncGeneratorFunctionInstance = hasAsyncIterator && g.eval('(async function*(){})');
    const AsyncGeneratorFunction = hasAsyncIterator && AsyncGeneratorFunctionInstance.constructor;
    const AsyncGenerator = hasAsyncIterator && AsyncGeneratorFunction.prototype;
    const AsyncGeneratorPrototype = hasAsyncIterator && AsyncGenerator.prototype;

    const AsyncIteratorPrototype = hasAsyncIterator && getPrototypeOf(AsyncGeneratorPrototype);
    const AsyncFromSyncIteratorPrototype = undefined; // Not reacheable.

    const MapIteratorObject = new g.Map()[SymbolIterator]();
    const MapIteratorPrototype = getPrototypeOf(MapIteratorObject);

    const SetIteratorObject = new g.Set()[SymbolIterator]();
    const SetIteratorPrototype = getPrototypeOf(SetIteratorObject);

    const StringIteratorObject = new g.String()[SymbolIterator]();
    const StringIteratorPrototype = getPrototypeOf(StringIteratorObject);

    const ThrowTypeError = g.eval(
      '(function () { "use strict"; return Object.getOwnPropertyDescriptor(arguments, "callee").get; })()'
    );

    const TypedArray = getPrototypeOf(g.Int8Array);
    const TypedArrayPrototype = TypedArray.prototype;

    // Named intrinsics

    const intrinsics = {
      // *** Table 7

      // %Array%
      Array: g.Array,
      // %ArrayBuffer%
      ArrayBuffer: g.ArrayBuffer,
      // %ArrayBufferPrototype%
      ArrayBufferPrototype: g.ArrayBuffer.prototype,
      // %ArrayIteratorPrototype%
      ArrayIteratorPrototype,
      // %ArrayPrototype%
      ArrayPrototype: g.Array.prototype,
      // %ArrayProto_entries%
      ArrayProto_entries: g.Array.prototype.entries,
      // %ArrayProto_foreach%
      ArrayProto_foreach: g.Array.prototype.forEach,
      // %ArrayProto_keys%
      ArrayProto_keys: g.Array.prototype.forEach,
      // %ArrayProto_values%
      ArrayProto_values: g.Array.prototype.values,
      // %AsyncFromSyncIteratorPrototype%
      AsyncFromSyncIteratorPrototype,
      // %AsyncFunction%
      AsyncFunction,
      // %AsyncFunctionPrototype%
      AsyncFunctionPrototype,
      // %AsyncGenerator%
      AsyncGenerator,
      // %AsyncGeneratorFunction%
      AsyncGeneratorFunction,
      // %AsyncGeneratorPrototype%
      AsyncGeneratorPrototype,
      // %AsyncIteratorPrototype%
      AsyncIteratorPrototype,
      // %Atomics%
      Atomics: g.Atomics,
      // %Boolean%
      Boolean: g.Boolean,
      // %BooleanPrototype%
      BooleanPrototype: g.Boolean.prototype,
      // %DataView%
      DataView: g.DataView,
      // %DataViewPrototype%
      DataViewPrototype: g.DataView.prototype,
      // %Date%
      Date: g.Date,
      // %DatePrototype%
      DatePrototype: g.Date.prototype,
      // %decodeURI%
      decodeURI: g.decodeURI,
      // %decodeURIComponent%
      decodeURIComponent: g.decodeURIComponent,
      // %encodeURI%
      encodeURI: g.encodeURI,
      // %encodeURIComponent%
      encodeURIComponent: g.encodeURIComponent,
      // %Error%
      Error: g.Error,
      // %ErrorPrototype%
      ErrorPrototype: g.Error.prototype,
      // %eval%
      eval: g.eval,
      // %EvalError%
      EvalError: g.EvalError,
      // %EvalErrorPrototype%
      EvalErrorPrototype: g.EvalError.prototype,
      // %Float32Array%
      Float32Array: g.Float32Array,
      // %Float32ArrayPrototype%
      Float32ArrayPrototype: g.Float32Array.prototype,
      // %Float64Array%
      Float64Array: g.Float64Array,
      // %Float64ArrayPrototype%
      Float64ArrayPrototype: g.Float64Array.prototype,
      // %Function%
      Function: g.Function,
      // %FunctionPrototype%
      FunctionPrototype: g.Function.prototype,
      // %Generator%
      Generator,
      // %GeneratorFunction%
      GeneratorFunction,
      // %GeneratorPrototype%
      GeneratorPrototype,
      // %Int8Array%
      Int8Array: g.Int8Array,
      // %Int8ArrayPrototype%
      Int8ArrayPrototype: g.Int8Array.prototype,
      // %Int16Array%
      Int16Array: g.Int16Array,
      // %Int16ArrayPrototype%,
      Int16ArrayPrototype: g.Int16Array.prototype,
      // %Int32Array%
      Int32Array: g.Int32Array,
      // %Int32ArrayPrototype%
      Int32ArrayPrototype: g.Int32Array.prototype,
      // %isFinite%
      isFinite: g.isFinite,
      // %isNaN%
      isNaN: g.isNaN,
      // %IteratorPrototype%
      IteratorPrototype,
      // %JSON%
      JSON: g.JSON,
      // %JSONParse%
      JSONParse: g.JSON.parse,
      // %Map%
      Map: g.Map,
      // %MapIteratorPrototype%
      MapIteratorPrototype,
      // %MapPrototype%
      MapPrototype: g.Map.prototype,
      // %Math%
      Math: g.Math,
      // %Number%
      Number: g.Number,
      // %NumberPrototype%
      NumberPrototype: g.Number.prototype,
      // %Object%
      Object: g.Object,
      // %ObjectPrototype%
      ObjectPrototype: g.Object.prototype,
      // %ObjProto_toString%
      ObjProto_toString: g.Object.prototype.toString,
      // %ObjProto_valueOf%
      ObjProto_valueOf: g.Object.prototype.valueOf,
      // %parseFloat%
      parseFloat: g.parseFloat,
      // %parseInt%
      parseInt: g.parseInt,
      // %Promise%
      Promise: g.Promise,
      // %Promise_all%
      Promise_all: g.Promise.all,
      // %Promise_reject%
      Promise_reject: g.Promise.reject,
      // %Promise_resolve%
      Promise_resolve: g.Promise.resolve,
      // %PromiseProto_then%
      PromiseProto_then: g.Promise.prototype.then,
      // %PromisePrototype%
      PromisePrototype: g.Promise.prototype,
      // %Proxy%
      Proxy: g.Proxy,
      // %RangeError%
      RangeError: g.RangeError,
      // %RangeErrorPrototype%
      RangeErrorPrototype: g.RangeError.prototype,
      // %ReferenceError%
      ReferenceError: g.ReferenceError,
      // %ReferenceErrorPrototype%
      ReferenceErrorPrototype: g.ReferenceError.prototype,
      // %Reflect%
      Reflect: g.Reflect,
      // %RegExp%
      RegExp: g.RegExp,
      // %RegExpPrototype%
      RegExpPrototype: g.RegExp.prototype,
      // %Set%
      Set: g.Set,
      // %SetIteratorPrototype%
      SetIteratorPrototype,
      // %SetPrototype%
      SetPrototype: g.Set.prototype,
      // %SharedArrayBuffer%
      // SharedArrayBuffer - Deprecated on Jan 5, 2018
      // %SharedArrayBufferPrototype%
      // SharedArrayBufferPrototype - Deprecated on Jan 5, 2018
      // %String%
      String: g.String,
      // %StringIteratorPrototype%
      StringIteratorPrototype,
      // %StringPrototype%
      StringPrototype: g.String.prototype,
      // %Symbol%
      Symbol: g.Symbol,
      // %SymbolPrototype%
      SymbolPrototype: g.Symbol.prototype,
      // %SyntaxError%
      SyntaxError: g.SyntaxError,
      // %SyntaxErrorPrototype%
      SyntaxErrorPrototype: g.SyntaxError.prototype,
      // %ThrowTypeError%
      ThrowTypeError,
      // %TypedArray%
      TypedArray,
      // %TypedArrayPrototype%
      TypedArrayPrototype,
      // %TypeError%
      TypeError: g.TypeError,
      // %TypeErrorPrototype%
      TypeErrorPrototype: g.TypeError.prototype,
      // %Uint8Array%
      Uint8Array: g.Uint8Array,
      // %Uint8ArrayPrototype%
      Uint8ArrayPrototype: g.Uint8Array.prototype,
      // %Uint8ClampedArray%
      Uint8ClampedArray: g.Uint8ClampedArray,
      // %Uint8ClampedArrayPrototype%
      Uint8ClampedArrayPrototype: g.Uint8ClampedArray.prototype,
      // %Uint16Array%
      Uint16Array: g.Uint16Array,
      // %Uint16ArrayPrototype%
      Uint16ArrayPrototype: g.Uint16Array.prototype,
      // %Uint32Array%
      Uint32Array: g.Uint32Array,
      // %Uint32ArrayPrototype%
      Uint32ArrayPrototype: g.Uint32Array.prototype,
      // %URIError%
      URIError: g.URIError,
      // %URIErrorPrototype%
      URIErrorPrototype: g.URIError.prototype,
      // %WeakMap%
      WeakMap: g.WeakMap,
      // %WeakMapPrototype%
      WeakMapPrototype: g.WeakMap.prototype,
      // %WeakSet%
      WeakSet: g.WeakSet,
      // %WeakSetPrototype%
      WeakSetPrototype: g.WeakSet.prototype,

      // *** Annex B

      // %escape%
      escape: g.escape,
      // %unescape%
      unescape: g.unescape,

      // *** ECMA-402

      Intl: g.Intl,

      // *** ESNext

      Realm // intentionally passing around the Realm Constructor, which could be used as a side channel, but still!
    };

    return intrinsics;
  }

  function assert(condition) {
    if (!condition) {
      throw new Error();
    }
  }

  function IsCallable(obj) {
    return typeof obj === 'function';
  }

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
  class Realm {
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

  return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
