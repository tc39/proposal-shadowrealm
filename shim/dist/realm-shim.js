(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Realm = factory());
}(this, (function () { 'use strict';

  const Intrinsics = Symbol('Intrinsics Slot');
  const GlobalObject = Symbol('GlobalObject Slot');
  const DirectEvalEvaluator = Symbol('DirectEvalEvaluator Slot');
  const ShimSandbox = Symbol('Shim Sandbox');

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
    // Properties stored on the handler
    // are not available from the proxy.

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
      // Properties of the global.
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

  function getDirectEvalEvaluatorFactory(sandbox) {
    const { unsafeFunction } = sandbox;

    // Create a function in sloppy mode that returns
    // a function in strict mode.
    return unsafeFunction(`
    with (arguments[0]) {
      return function() {
        'use strict';
        return eval(arguments[0]);
      };
    }
  `);
  }

  function getDirectEvalEvaluator(realmRec) {
    const { [ShimSandbox]: sandbox, [GlobalObject]: globalObject } = realmRec;

    // This proxy has several functions:
    // 1. works with the sentinel to alternate between direct eval and confined eval.
    // 2. shadows all properties of the hidden global by declaring them as undefined.
    // 3. resolves all existing properties of the sandboxed global.
    const handler = new Handler(sandbox);
    const proxy = new Proxy(globalObject, handler);

    const scopedEvaluator = sandbox.evalEvaluatorFactory(proxy);

    // Create an eval without a [[Construct]] behavior such that the
    // invocation "new eval()" throws TypeError: eval is not a constructor".
    const evaluator = {
      eval(src) {
        handler.isInternalEvaluation = true;
        // Ensure that "this" resolves to the secure global.
        const result = scopedEvaluator.call(globalObject, src);
        handler.isInternalEvaluation = false;
        return result;
      }
    }.eval;

    // Ensure that eval from any compartment in a root realm is an
    // instance of Function in any compartment of the same root ralm.
    const { unsafeFunction } = sandbox;
    setPrototypeOf(evaluator, unsafeFunction.prototype.constructor);

    // Once created for a realm, the reference must be updated everywhere.
    return evaluator;
  }

  /**
   * A safe version of the native Function which relies on
   * the safety of evalEvaluator for confinement.
   */
  function getFunctionEvaluator(realmRec) {
    const { [ShimSandbox]: sandbox, [Intrinsics]: intrinsics } = realmRec;

    const evaluator = function Function(...params) {
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
    };

    // Ensure that Function from any compartment in a root realm can be used
    // with instance checks in any compartment of the same root realm.
    const { unsafeFunction } = sandbox;
    setPrototypeOf(evaluator, unsafeFunction.prototype.constructor);

    // Ensure that any function created in any compartment in a root realm is an
    // instance of Function in any compartment of the same root ralm.
    const desc = getOwnPropertyDescriptor(evaluator, 'prototype');
    desc.value = unsafeFunction.prototype;
    defineProperty(evaluator, 'prototype', desc);

    // Once created for a realm, the reference must be everywhere.
    return evaluator;
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
    const TamedFunction = unsafeFunction('throw new Error("Not available");');

    defineProperties(TamedFunction, {
      name: {
        value: functionName
      },
      prototype: {
        value: FunctionPrototype
      }
    });
    defineProperty(FunctionPrototype, 'constructor', { value: TamedFunction });

    // Ensures that all functions meet "instanceof Function" in a realm.
    setPrototypeOf(TamedFunction, unsafeFunction.prototype.constructor);
  }

  /**
   * This block replaces the original Function constructor, and the original
   * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
   * safe replacements that preserve SES confinement. After this block is done,
   * the originals should no longer be reachable.
   */
  function repairFunctions(sandbox) {
    const { unsafeGlobal: g } = sandbox;

    // Here, the order of operation is important: Function needs to be
    // repaired first since the other constructors need it.
    repairFunction(sandbox, 'Function', 'function');
    repairFunction(sandbox, 'GeneratorFunction', 'function*');
    repairFunction(sandbox, 'AsyncFunction', 'async function');

    const hasAsyncIteration = typeof g.Symbol.asyncIterator !== 'undefined';
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

  function createBrowserContext() {
    const iframe = document.createElement('iframe');

    iframe.title = 'script';
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', true);

    document.body.appendChild(iframe);

    return iframe.contentWindow;
  }

  function createSandbox(context) {
    if (context === undefined) {
      context = createBrowserContext();
    }

    // The sandbox is entirely defined by these three objects.
    // Reusing the terminology from SES/Caja.
    const sandbox = {
      unsafeGlobal: context,
      unsafeEval: context.eval,
      unsafeFunction: context.Function
    };

    // Create the evaluator factory that will generate the evaluators
    // for each compartment realm.
    sandbox.evalEvaluatorFactory = getDirectEvalEvaluatorFactory(sandbox);

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

      // Make eval wrtitable to allow proxy to return a different
      // value, and leave it non-unconfigurable to prevent userland
      // from changing its descriptor and breaking an invariant.
      eval: { value: i.eval, writable: true },
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
      // SharedArrayBuffer // Deprecated on Jan 5, 2018
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

      // Atomics: { value: i.Atomics }, // Deprecated on Jan 5, 2018
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
  function getIntrinsics(sandbox) {
    const { unsafeGlobal: g } = sandbox;

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
      // Atomics: g.Atomics, // Deprecated on Jan 5, 2018
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
      // SharedArrayBuffer // Deprecated on Jan 5, 2018
      // %SharedArrayBufferPrototype%
      // SharedArrayBufferPrototype // Deprecated on Jan 5, 2018
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
      Realm: g.Realm
    };

    return intrinsics;
  }

  function IsCallable(obj) {
    return typeof obj === 'function';
  }

  const Realm2RealmRec = new WeakMap();
  const Realm2Sandbox = new WeakMap();

  function getCurrentContext() {
    // eslint-disable-next-line no-new-func
    return new Function('return this')();
  }

  function getCurrentSandbox() {
    const context = getCurrentContext();
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

    unsafeGlobal.Realm = unsafeFunction(
      'base',
      'Realm2Sandbox',
      'sandbox',
      `

function Realm(options) {
  Realm2Sandbox.set(this, sandbox);
  base.call(this, options);
}

const descs = Object.getOwnPropertyDescriptors(base.prototype);

Object.defineProperties(Realm.prototype, {
  init: {
    value() {
      return descs.init.value.call(this);
    }
  },
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
  evaluate: {
    value(x) {
      return descs.evaluate.value.call(this, x);
    }
  }
});

Realm.toString = () => base.toString();

return Realm;

  `
    )(Realm, Realm2Sandbox, sandbox);
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

  // The current sandbox is the sandbox where the
  // Realm shim is being parsed and executed.
  const currentSandbox = getCurrentSandbox();

  function Realm(options) {
    const O = this;
    const opts = Object(options);

    let sandbox;
    let intrinsics = opts.intrinsics;
    if (intrinsics === 'inherit') {
      // In "inherit" mode, we create a compartment realm and inherit
      // the sandbox since we share the intrinsics. We create a new
      // set to allow us to define eval() anf Function() for the realm.
      if (Realm2Sandbox.has(O)) {
        sandbox = Realm2Sandbox.get(O);
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

    Realm2RealmRec.set(O, realmRec);

    setGlobaObject(realmRec);

    const init = O.init;
    if (!IsCallable(init)) throw new TypeError();
    init.call(O);
  }

  defineProperties(Realm.prototype, {
    init: {
      value() {
        const O = this;
        if (typeof O !== 'object') throw new TypeError();
        if (!Realm2RealmRec.has(O)) throw new TypeError();
        const realmRec = Realm2RealmRec.get(O);
        createEvaluators(realmRec);
        setDefaultBindings(realmRec);
      }
    },
    intrinsics: {
      get() {
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
    },
    global: {
      get() {
        const O = this;
        if (typeof O !== 'object') throw new TypeError();
        if (!Realm2RealmRec.has(O)) throw new TypeError();
        const realmRec = Realm2RealmRec.get(O);
        return realmRec[GlobalObject];
      }
    },
    evaluate: {
      value(x) {
        const O = this;
        if (typeof O !== 'object') throw new TypeError();
        if (!Realm2RealmRec.has(O)) throw new TypeError();
        const realmRec = Realm2RealmRec.get(O);
        const evaluator = realmRec[DirectEvalEvaluator];
        return evaluator(x);
      }
    }
  });

  Realm.toString = () => 'function Realm() { [shim code] }';

  return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
