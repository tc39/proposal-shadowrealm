(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Realm = factory());
}(this, (function () { 'use strict';

  const Intrinsics = Symbol('Intrinsics Slot');
  const GlobalObject = Symbol('GlobalObject Slot');
  const IsDirectEvalTrap = Symbol('IsDirectEvalTrap Slot');
  const ContextRec = Symbol('Shim Context');

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

  const objectHasOwnProperty = Object.prototype.hasOwnProperty;

  class Handler {
    // Properties stored on the handler
    // are not available from the proxy.

    constructor(contextRec) {
      const { contextGlobal } = contextRec;
      this.contextGlobal = contextGlobal;

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
          return this.contextGlobal.eval;
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
      if (prop in this.contextGlobal) {
        return true;
      }
      return false;
    }
  }

  // Portions adapted from V8 - Copyright 2016 the V8 project authors.

  function buildOptimizer(constants) {
    if (!Array.isArray(constants)) {
      return '';
    }
    if (constants.contains('eval')) throw new Error();

    return `const {${constants.join(',')}} = arguments[0];`;
  }

  function getDirectEvalEvaluatorFactory(contextRec, constants) {
    const { contextFunction } = contextRec;

    const optimizer = buildOptimizer(constants);

    // Create a function in sloppy mode that returns
    // a function in strict mode.
    return contextFunction(`
    with (arguments[0]) {
      ${optimizer}
      return function() {
        'use strict';
        return eval(arguments[0]);
      };
    }
  `);
  }

  function getDirectEvalEvaluator(realmRec) {
    const { [ContextRec]: contextRec, [GlobalObject]: globalObject } = realmRec;

    // This proxy has several functions:
    // 1. works with the sentinel to alternate between direct eval and confined eval.
    // 2. shadows all properties of the hidden global by declaring them as undefined.
    // 3. resolves all existing properties of the sandboxed global.
    const handler = new Handler(contextRec);
    const proxy = new Proxy(globalObject, handler);

    const scopedEvaluator = contextRec.evalEvaluatorFactory(proxy);

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
    const { contextGlobal, contextFunction } = contextRec;
    setPrototypeOf(evaluator, contextFunction.prototype.constructor);

    defineProperty(evaluator.prototype, contextGlobal.Symbol.toStringTag, {
      value: 'function eval() { [shim code] }',
      writable: false,
      enumerable: false,
      configurable: true
    });
    return evaluator;
  }

  /**
   * A safe version of the native Function which relies on
   * the safety of evalEvaluator for confinement.
   */
  function getFunctionEvaluator(realmRec) {
    const { [ContextRec]: contextRec, [Intrinsics]: intrinsics } = realmRec;

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
    const { contextGlobal, contextFunction } = contextRec;
    setPrototypeOf(evaluator, contextFunction.prototype.constructor);

    // Ensure that any function created in any compartment in a root realm is an
    // instance of Function in any compartment of the same root ralm.
    const desc = getOwnPropertyDescriptor(evaluator, 'prototype');
    desc.value = contextFunction.prototype;
    defineProperty(evaluator, 'prototype', desc);

    // Provide a custom output without overwriting the Function.prototype.toString
    // which is called by some libraries.
    defineProperty(evaluator.prototype, contextGlobal.Symbol.toStringTag, {
      value: 'function Function() { [shim code] }',
      writable: false,
      enumerable: false,
      configurable: true
    });
    return evaluator;
  }

  // Adapted from SES/Caja - Copyright (C) 2011 Google Inc.

  /**
   * Replace the legacy accessors of Object to comply with strict mode
   * and ES2016 semantics, we do this by redefining them while in 'use strict'
   * https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__
   */
  function repairAccessors(contextRec) {
    const { contextGlobal: g } = contextRec;

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
  function repairFunction(contextRec, functionName, functionDecl) {
    const { contextEval, contextFunction } = contextRec;

    const FunctionInstance = contextEval(`(${functionDecl}(){})`);
    const FunctionPrototype = getPrototypeOf(FunctionInstance);

    // Block evaluation of source when calling constructor on the prototype of functions.
    const TamedFunction = contextFunction('throw new Error("Not available");');

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
    setPrototypeOf(TamedFunction, contextFunction.prototype.constructor);
  }

  /**
   * This block replaces the original Function constructor, and the original
   * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
   * safe replacements that preserve SES confinement. After this block is done,
   * the originals should no longer be reachable.
   */
  function repairFunctions(contextRec) {
    const { contextGlobal: g } = contextRec;

    // Here, the order of operation is important: Function needs to be
    // repaired first since the other constructors need it.
    repairFunction(contextRec, 'Function', 'function');
    repairFunction(contextRec, 'GeneratorFunction', 'function*');
    repairFunction(contextRec, 'AsyncFunction', 'async function');

    const hasAsyncIteration = typeof g.Symbol.asyncIterator !== 'undefined';
    if (hasAsyncIteration) {
      repairFunction(contextRec, 'AsyncGeneratorFunction', 'async function*');
    }
  }

  // Sanitizing ensures that neither the legacy
  // accessors nor the function constructors can be
  // used to escape the confinement of the evaluators
  // to execute in the context.

  function sanitize(contextRec) {
    repairAccessors(contextRec);
    repairFunctions(contextRec);
  }

  // Detection used in RollupJS.
  const isNode = typeof exports === 'object' && typeof module !== 'undefined';
  const vm = isNode ? require('vm') : undefined;

  const contextRecSrc = '({ global: this, eval, Function })';

  // The contextRec is shim-specific. It acts as the mechanism
  // to obtain a fresh set of intrinsics together with their
  // associated eval and Function evaluators. This association
  // must be respected since the evaluators are imposing a
  // set of intrinsics, aka the "undeniables".

  function createNodeContext() {
    const context = vm.runInNewContext(contextRecSrc);
    return context;
  }

  function createBrowserContext() {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';

    document.body.appendChild(iframe);
    const context = iframe.contentWindow.eval(contextRecSrc);

    return context;
  }

  const createContext = isNode ? createNodeContext : createBrowserContext;

  function createContextRec(context) {
    if (context === undefined) {
      context = createContext();
    }

    const contextRec = {
      contextGlobal: context.global,
      contextEval: context.eval,
      contextFunction: context.Function
    };

    // Create the evaluator factory that will generate the evaluators
    // for each compartment realm.
    contextRec.evalEvaluatorFactory = getDirectEvalEvaluatorFactory(contextRec);

    sanitize(contextRec);
    return contextRec;
  }

  // The current context is the context where the
  // Realm shim is being parsed and executed.
  function getCurrentContext() {
    return (0, eval)(contextRecSrc);
  }

  function getCurrentContextRec() {
    const context = getCurrentContext();
    return createContextRec(context);
  }

  function getStdLib(intrinsics) {
    const i = intrinsics;

    return {
      // *** 18.1 Value Properties of the Global Object

      Infinity: { value: Infinity },
      NaN: { value: NaN },
      undefined: { value: undefined },

      // *** 18.2 Function Properties of the Global Object

      // Make eval writable to allow proxy to return a different
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
  function getIntrinsics(contextRec) {
    const { contextGlobal: g } = contextRec;

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

  // Adapted from SES/Caja

  /**
   * For a special set of properties (defined below), it ensures that the
   * effect of freezing does not suppress the ability to override these
   * properties on derived objects by simple assignment.
   *
   * Because of lack of sufficient foresight at the time, ES5 unfortunately
   * specified that a simple assignment to a non-existent property must fail if
   * it would override a non-writable data property of the same name. (In
   * retrospect, this was a mistake, but it is now too late and we must live
   * with the consequences.) As a result, simply freezing an object to make it
   * tamper proof has the unfortunate side effect of breaking previously correct
   * code that is considered to have followed JS best practices, if this
   * previous code used assignment to override.
   *
   * To work around this mistake, deepFreeze(), prior to freezing, replaces
   * selected configurable own data properties with accessor properties which
   * simulate what we should have specified -- that assignments to derived
   * objects succeed if otherwise possible.
   */
  function tamperProof(obj, prop, desc) {
    if ('value' in desc && desc.configurable) {
      const value = desc.value;

      // eslint-disable-next-line no-inner-declarations
      function getter() {
        return value;
      }

      // Re-attach the data property on the object so
      // it can be found by the deep-freeze traversal process.
      getter.value = value;

      // eslint-disable-next-line no-inner-declarations
      function setter(newValue) {
        if (obj === this) {
          throw new TypeError(`Cannot assign to read only property '${prop}' of object '${obj}'`);
        }
        if (objectHasOwnProperty.call(this, prop)) {
          this[prop] = newValue;
        } else {
          defineProperty(this, prop, {
            value: newValue,
            writable: true,
            enumerable: desc.enumerable,
            configurable: desc.configurable
          });
        }
      }

      defineProperty(obj, prop, {
        get: getter,
        set: setter,
        enumerable: desc.enumerable,
        configurable: desc.configurable
      });
    }
  }

  function tamperProofProperties(obj) {
    const descs = getOwnPropertyDescriptors(obj);
    for (const prop in descs) {
      const desc = descs[prop];
      tamperProof(obj, prop, desc);
    }
  }

  function tamperProofProperty(obj, prop) {
    const desc = getOwnPropertyDescriptor(obj, prop);
    tamperProof(obj, prop, desc);
  }

  /**
   * These properties are subject to the override mistake
   * and must be converted before freezing.
   */
  function tamperProofDataProperties(intrinsics) {
    const i = intrinsics;

    [i.ObjectPrototype, i.ArrayPrototype, i.FunctionPrototype].forEach(tamperProofProperties);

    // Intentionally avoid loops and data structures.
    tamperProofProperty(i.ErrorPrototype, 'message');
    tamperProofProperty(i.EvalErrorPrototype, 'message');
    tamperProofProperty(i.RangeErrorPrototype, 'message');
    tamperProofProperty(i.ReferenceErrorPrototype, 'message');
    tamperProofProperty(i.SyntaxErrorPrototype, 'message');
    tamperProofProperty(i.TypeErrorPrototype, 'message');
    tamperProofProperty(i.URIErrorPrototype, 'message');
  }

  // Adapted from SES/Caja - Copyright (C) 2011 Google Inc.

  // Objects that are deeply frozen.
  const frozenSet = new WeakSet();

  /**
   * "deepFreeze()" acts like "Object.freeze()", except that:
   *
   * To deepFreeze an object is to freeze it and all objects transitively
   * reachable from it via transitive reflective property and prototype
   * traversal.
   */
  function deepFreeze(node) {
    // Objects that we have frozen in this round.
    const freezingSet = new Set();

    // If val is something we should be freezing but aren't yet,
    // add it to freezingSet.
    function enqueue(val) {
      if (Object(val) !== val) {
        // ignore primitives
        return;
      }
      const type = typeof val;
      if (type !== 'object' && type !== 'function') {
        // future proof: break until someone figures out what it should do
        throw new TypeError(`Unexpected typeof: ${type}`);
      }
      if (frozenSet.has(val) || freezingSet.has(val)) {
        // Ignore if already frozen or freezing
        return;
      }
      freezingSet.add(val);
    }

    function doFreeze(obj) {
      // Immediately freeze the object to ensure reactive
      // objects such as proxies won't add properties
      // during traversal, before they get frozen.

      // Object are verified before being enqueued,
      // therefore this is a valid candidate.
      // Throws if this fails (strict mode).
      freeze(obj);

      enqueue(getPrototypeOf(obj));
      const descs = getOwnPropertyDescriptors(obj);
      ownKeys(descs).forEach(name => {
        const desc = descs[name];
        if ('value' in desc) {
          enqueue(desc.value);
        } else {
          enqueue(desc.get);
          enqueue(desc.set);
        }
      });
    }

    function dequeue() {
      // New values added before forEach() has finished will be visited.
      freezingSet.forEach(doFreeze);
    }

    function commit() {
      freezingSet.forEach(frozenSet.add, frozenSet);
    }

    enqueue(node);
    dequeue();
    commit();
  }

  function IsCallable(obj) {
    return typeof obj === 'function';
  }

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

  class Realm {
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

  return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
