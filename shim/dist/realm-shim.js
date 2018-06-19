(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Realm = factory());
}(this, (function () { 'use strict';

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

    constructor(unsafeRec) {
      this.unsafeGlobal = unsafeRec.unsafeGlobal;
      this.unsafeEval = unsafeRec.unsafeGlobal.eval;

      // this flag allow us to determine if the eval() call is a controlled
      // eval done by the realm's code or if it is user-land invocation, so
      // we can react differently.
      this.useUnsafeEvaluator = false;
    }

    get(target, prop) {
      // Special treatment for eval.
      if (prop === 'eval') {
        if (this.useUnsafeEvaluator) {
          this.useUnsafeEvaluator = false;
          return this.unsafeEval;
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

  function buildOptimizer(constants) {
    if (!Array.isArray(constants)) {
      return '';
    }
    if (constants.contains('eval')) throw new Error();

    return `const {${constants.join(',')}} = arguments[0];`;
  }

  function getScopedEvaluatorFactory(unsafeRec, constants) {
    const { unsafeFunction } = unsafeRec;

    const optimizer = buildOptimizer(constants);

    // Create a function in sloppy mode that returns
    // a function in strict mode.
    return unsafeFunction(`
    with (arguments[0]) {
      ${optimizer}
      return function() {
        'use strict';
        return eval(arguments[0]);
      };
    }
  `);
  }

  function getSafeEvaluator(realmRec) {
    const { unsafeRec, globalObject } = realmRec;

    // This proxy has several functions:
    // 1. works with the sentinel to alternate between direct eval and confined eval.
    // 2. shadows all properties of the hidden global by declaring them as undefined.
    // 3. resolves all existing properties of the sandboxed global.
    const handler = new Handler(unsafeRec);
    const proxy = new Proxy(globalObject, handler);

    const scopedEvaluator = unsafeRec.scopedEvaluatorFactory(proxy);

    // We use the the concise method syntax to create an eval without a
    // [[Construct]] behavior (such that the invocation "new eval()" throws
    // TypeError: eval is not a constructor"), but which still accepts a 'this'
    // binding.
    const evaluator = {
      eval(src) {
        handler.useUnsafeEvaluator = true;
        try {
          // Ensure that "this" resolves to the secure global.
          return scopedEvaluator.call(globalObject, src);
        } finally {
          // belt and suspenders: the proxy switches this off immediately after
          // the first access, but just in case we clear it here too
          handler.useUnsafeEvaluator = false;
        }
      }
    }.eval;

    // Ensure that eval from any compartment in a root realm is an
    // instance of Function in any compartment of the same root realm.
    const { unsafeGlobal, unsafeFunction } = unsafeRec;
    setPrototypeOf(evaluator, unsafeFunction.prototype);

    defineProperty(evaluator, unsafeGlobal.Symbol.toStringTag, {
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
  function getFunctionEvaluator(unsafeFunction, unsafeGlobal, safeEvaluator) {
    const SafeFunction = function Function(...params) {
      const functionBody = `${params.pop()}` || '';
      let functionParams = `${params.join(',')}`;

      // Is this a real functionBody, or is someone attempting an injection
      // attack? This will throw a SyntaxError if the string is not actually a
      // function body. We coerce the body into a real string above to prevent
      // someone from passing an object with a toString() that returns a safe
      // string the first time, but an evil string the second time.
      new unsafeFunction(functionBody); // eslint-disable-line

      if (functionParams.includes(')')) {
        // If the formal parameters string include ) - an illegal
        // character - it may make the combined function expression
        // compile. We avoid this problem by checking for this early on.
        throw new SyntaxError('Function arg string contains parenthesis');
      }

      if (functionParams.length > 0) {
        // If the formal parameters include an unbalanced block comment, the
        // function must be rejected. Since JavaScript does not allow nested
        // comments we can include a trailing block comment to catch this.
        functionParams += '\n/*``*/';
      }

      const src = `(function(${functionParams}){\n${functionBody}\n})`;

      return safeEvaluator(src);
    };

    // Ensure that Function from any compartment in a root realm can be used
    // with instance checks in any compartment of the same root realm.
    setPrototypeOf(SafeFunction, unsafeFunction.prototype);

    // Ensure that any function created in any compartment in a root realm is an
    // instance of Function in any compartment of the same root ralm.
    defineProperty(SafeFunction, 'prototype', { value: unsafeFunction.prototype });

    // Provide a custom output without overwriting the Function.prototype.toString
    // which is called by some libraries.
    defineProperty(SafeFunction, unsafeGlobal.Symbol.toStringTag, {
      value: 'function Function() { [shim code] }',
      writable: false,
      enumerable: false,
      configurable: true
    });
    return SafeFunction;
  }

  // Adapted from SES/Caja - Copyright (C) 2011 Google Inc.

  /**
   * Replace the legacy accessors of Object to comply with strict mode
   * and ES2016 semantics, we do this by redefining them while in 'use strict'
   * https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__
   */
  function repairAccessors(unsafeRec) {
    const { unsafeGlobal: g } = unsafeRec;

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
  function repairFunction(unsafeRec, functionName, functionDecl) {
    const { unsafeEval, unsafeFunction, unsafeGlobal } = unsafeRec;

    let FunctionInstance;
    try {
      FunctionInstance = unsafeEval(`(${functionDecl}(){})`);
    } catch (e) {
      if (!(e instanceof unsafeGlobal.SyntaxError)) {
        // Re-throw
        throw e;
      }
      // Prevent failure on platforms where generators are not supported.
      return;
    }
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
    // todo: why does this work? it used to be done only for 'Function', but by
    // doing it on all types, it should set up a circular prototype chain
  }

  /**
   * This block replaces the original Function constructor, and the original
   * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
   * safe replacements that preserve SES confinement. After this block is done,
   * the originals should no longer be reachable.
   */
  function repairFunctions(unsafeRec) {
    // Here, the order of operation is important: Function needs to be
    // repaired first since the other constructors need it.
    repairFunction(unsafeRec, 'Function', 'function');
    repairFunction(unsafeRec, 'GeneratorFunction', 'function*');
    repairFunction(unsafeRec, 'AsyncFunction', 'async function');
    repairFunction(unsafeRec, 'AsyncGeneratorFunction', 'async function*');
  }

  // Sanitizing ensures that neither the legacy
  // accessors nor the function constructors can be
  // used to escape the confinement of the evaluators
  // to execute in the context.

  function sanitize(unsafeRec) {
    repairAccessors(unsafeRec);
    repairFunctions(unsafeRec);
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

  function createUnsafeRec(context) {
    if (context === undefined) {
      context = createContext();
    }

    const unsafeRec = {
      unsafeGlobal: context.global,
      unsafeEval: context.eval,
      unsafeFunction: context.Function
    };

    // Create the evaluator factory that will generate the evaluators
    // for each compartment realm.
    unsafeRec.scopedEvaluatorFactory = getScopedEvaluatorFactory(unsafeRec);

    sanitize(unsafeRec);
    return unsafeRec;
  }

  // The current context is the context where the
  // Realm shim is being parsed and executed.
  function getCurrentContext() {
    return (0, eval)(contextRecSrc);
  }

  function getCurrentUnsafeRec() {
    const context = getCurrentContext();
    return createUnsafeRec(context);
  }

  function getStdLib(intrinsics, safeEvaluators) {
    const descriptors = {
      // *** 18.1 Value Properties of the Global Object

      Infinity: { value: Infinity },
      NaN: { value: NaN },
      undefined: { value: undefined }
    };

    // All the following stdlib items have the same name on both our intrinsics
    // object and on the global object. Unlike Infinity/NaN/undefined, these
    // should all be writable and configurable.
    const namedIntrinsics = [
      // *** 18.2 Function Properties of the Global Object

      // 'eval', // comes from safeEvaluators instead
      'isFinite',
      'isNaN',
      'parseFloat',
      'parseInt',

      'decodeURI',
      'decodeURIComponent',
      'encodeURI',
      'encodeURIComponent',

      // *** 18.3 Constructor Properties of the Global Object

      'Array',
      'ArrayBuffer',
      'Boolean',
      'DataView',
      'Date',
      'Error',
      'EvalError',
      'Float32Array',
      'Float64Array',
      // 'Function', // comes from safeEvaluators instead
      'Int8Array',
      'Int16Array',
      'Int32Array',
      'Map',
      'Number',
      'Object',
      'Promise',
      'Proxy',
      'RangeError',
      'ReferenceError',
      'RegExp',
      'Set',
      // 'SharedArrayBuffer' // Deprecated on Jan 5, 2018
      'String',
      'Symbol',
      'SyntaxError',
      'TypeError',
      'Uint8Array',
      'Uint8ClampedArray',
      'Uint16Array',
      'Uint32Array',
      'URIError',
      'WeakMap',
      'WeakSet',

      // *** 18.4 Other Properties of the Global Object

      // 'Atomics', // Deprecated on Jan 5, 2018
      'JSON',
      'Math',
      'Reflect',

      // *** Annex B

      'escape',
      'unescape',

      // *** ECMA-402

      'Intl',

      // *** ESNext

      'Realm'
    ];

    for (const name of namedIntrinsics) {
      descriptors[name] = {
        value: intrinsics[name],
        writable: true,
        configurable: true
      };
    }

    // add the safe named evaluators

    // *** 18.2 Function Properties of the Global Object
    descriptors.eval = {
      value: safeEvaluators.eval,
      writable: true,
      configurable: true // todo: maybe make this non-configurable
    };

    // *** 18.3 Constructor Properties of the Global Object
    descriptors.Function = {
      value: safeEvaluators.Function,
      writable: true,
      configurable: true
    };

    // TODO: we changed eval to be configurable along with everything else,
    // should we change it back to honor this earlier comment?
    // // Make eval writable to allow proxy to return a different
    // // value, and leave it non-configurable to prevent userland
    // // from changing its descriptor and breaking an invariant.

    // we need to prevent the user from manipulating the 'eval' binding while
    // simultaneously enabling the proxy to *switch* the 'eval' binding

    return descriptors;
  }

  /**
   * Get the intrinsics from Table 7 & Annex B
   * Named intrinsics: available as data properties of the global object.
   * Anonymous intrinsics: not otherwise reachable by own property name traversal.
   *
   * https://tc39.github.io/ecma262/#table-7
   * https://tc39.github.io/ecma262/#table-73
   */
  function getSharedIntrinsics(contextGlobal) {
    const g = contextGlobal;

    // the .constructor properties on evaluator intrinsics should already be
    // fixed by this point, due to the sanitize() call inside createUnsafeRec()

    // Anonymous intrinsics.

    const SymbolIterator = g.Symbol.iterator;

    const ArrayIteratorInstance = new g.Array()[SymbolIterator]();
    const ArrayIteratorPrototype = getPrototypeOf(ArrayIteratorInstance);
    const IteratorPrototype = getPrototypeOf(ArrayIteratorPrototype);

    // Ensure parsing doesn't fail on platforms that don't support Async Functions.
    let AsyncFunctionInstance;
    try {
      AsyncFunctionInstance = g.eval('(async function(){})');
    } catch (e) {
      if (!(e instanceof g.SyntaxError)) {
        // Re-throw
        throw e;
      }
    }

    // const AsyncFunction = AsyncFunctionInstance && AsyncFunctionInstance.constructor;
    const AsyncFunctionPrototype = AsyncFunctionInstance && getPrototypeOf(AsyncFunctionInstance);

    // Ensure parsing doesn't fail on platforms that don't support Generator Functions.
    let GeneratorFunctionInstance;
    try {
      GeneratorFunctionInstance = g.eval('(function*(){})');
    } catch (e) {
      if (!(e instanceof g.SyntaxError)) {
        // Re-throw
        throw e;
      }
    }
    // const GeneratorFunction = GeneratorFunctionInstance && GeneratorFunctionInstance.constructor;
    const Generator = GeneratorFunctionInstance && getPrototypeOf(GeneratorFunctionInstance);
    const GeneratorPrototype = GeneratorFunctionInstance && Generator.prototype;

    // Ensure parsing doesn't fail on platforms that don't support Async Generator Functions.
    let AsyncGeneratorFunctionInstance;
    try {
      AsyncGeneratorFunctionInstance = g.eval('(async function*(){})');
    } catch (e) {
      if (!(e instanceof g.SyntaxError)) {
        // Re-throw
        throw e;
      }
    }
    // const AsyncGeneratorFunction =
    //  AsyncGeneratorFunctionInstance && AsyncGeneratorFunctionInstance.constructor;
    const AsyncGenerator =
      AsyncGeneratorFunctionInstance && getPrototypeOf(AsyncGeneratorFunctionInstance);
    const AsyncGeneratorPrototype = AsyncGeneratorFunctionInstance && AsyncGenerator.prototype;

    const AsyncIteratorPrototype =
      AsyncGeneratorFunctionInstance && getPrototypeOf(AsyncGeneratorPrototype);
    // const AsyncFromSyncIteratorPrototype = undefined; // Not reacheable.

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

    const sharedIntrinsics = {
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
      // AsyncFromSyncIteratorPrototype, // Not reachable
      // %AsyncFunctionPrototype%
      AsyncFunctionPrototype,
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
      // %FunctionPrototype%
      FunctionPrototype: g.Function.prototype,
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

      // *** ESNext.
      // This is in sharedIntrinsics because there's only one Realm constructor
      // per RootRealm even though there's one Realm instance per Realm.
      // Compartments use the Realm constructor from their parent RootRealm.
      Realm: g.Realm
    };

    // sharedIntrinsics are per RootRealm
    return sharedIntrinsics;
  }

  const Realm2RealmRec = new WeakMap();
  const RealmProto2UnsafeRec = new WeakMap();

  // buildChildRealm is immediately turned into a string, and this function is
  // never referenced again, because it closes over the wrong intrinsics

  function buildChildRealm(BaseRealm) {
    const errorConstructors = new Map([
      ['EvalError', EvalError],
      ['RangeError', RangeError],
      ['ReferenceError', ReferenceError],
      ['SyntaxError', SyntaxError],
      ['TypeError', TypeError],
      ['URIError', URIError]
    ]);

    // Like Realm.apply except that it catches anything thrown and rethrows it
    // as an Error from this realm
    function doAndWrapError(thunk) {
      try {
        return thunk();
      } catch (err) {
        if (Object(err) !== err) {
          throw err;
        }
        let eName, eMessage;
        try {
          // The child environment might seek to use 'err' to reach the
          // parent's intrinsics and corrupt them. `${err.name}` will cause
          // string coercion of 'err.name'. If err.name is an object (probably
          // a String of the parent Realm), the coercion uses
          // err.name.toString(), which is under the control of the parent. If
          // err.name were a primitive (e.g. a number), it would use
          // Number.toString(err.name), using the child's version of Number
          // (which the child could modify to capture its argument for later
          // use), however primitives don't have properties like .prototype so
          // they aren't useful for an attack.
          eName = `${err.name}`;
          eMessage = `${err.message}`;
          // eName and eMessage are now child-realm primitive strings, and safe
          // to expose
        } catch (_) {
          // if err.name.toString() throws, keep the (parent realm) Error away
          // from the child
          throw new Error('Something bad happened');
        }
        const ErrorConstructor = errorConstructors.get(eName) || Error;
        throw new ErrorConstructor(eMessage);
      }
    }

    const descs = Object.getOwnPropertyDescriptors(BaseRealm.prototype);

    class Realm {
      constructor(...args) {
        return doAndWrapError(() => Reflect.construct(BaseRealm, args, Realm));
      }
      get intrinsics() {
        return doAndWrapError(() => descs.intrinsics.get.apply(this));
      }
      get global() {
        return doAndWrapError(() => descs.global.get.apply(this));
      }
      evaluate(...args) {
        return doAndWrapError(() => descs.evaluate.value.apply(this, args));
      }
      static makeRootRealm() {
        return new Realm();
      }
      static makeCompartment() {
        return new Realm({
          transform: 'inherit',
          isDirectEval: 'inherit',
          intrinsics: 'inherit'
        });
      }
    }

    Object.defineProperty(Realm.prototype, Symbol.toStringTag, {
      value: 'function Realm() { [shim code] }',
      writable: false,
      enumerable: false,
      configurable: true
    });

    return Realm;
  }

  const buildChildRealmString = `(${buildChildRealm})`;

  function createRealmFacade(unsafeRec, BaseRealm) {
    const { unsafeEval, unsafeGlobal } = unsafeRec;

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
    const Realm = unsafeEval(buildChildRealmString)(BaseRealm);
    unsafeGlobal.Realm = Realm;
    RealmProto2UnsafeRec.set(Realm.prototype, unsafeRec);
  }

  function getGlobalObject(intrinsics) {
    return create(intrinsics.ObjectPrototype);
  }

  function createEvaluators(realmRec) {
    // Divergence from specifications: the evaluators are tied to
    // a global and they are tied to a realm and to the intrinsics
    // of that realm.
    const safeEvaluator = getSafeEvaluator(realmRec);
    const functionEvaluator = getFunctionEvaluator(
      realmRec.unsafeRec.unsafeFunction,
      realmRec.unsafeRec.unsafeGlobal,
      safeEvaluator
    );

    // Limitation: export a direct evaluator.
    realmRec.safeEvaluators = { eval: safeEvaluator, Function: functionEvaluator };
  }

  function setDefaultBindings(realmRec) {
    const intrinsics = realmRec.sharedIntrinsics;
    const safeEvaluators = realmRec.safeEvaluators;
    const descs = getStdLib(intrinsics, safeEvaluators);
    defineProperties(realmRec.globalObject, descs);
  }

  class Realm {
    constructor(options) {
      const O = this;
      options = Object(options); // Todo: sanitize

      if (options.thisValue !== undefined) {
        throw new TypeError('Realm only supports undefined thisValue.');
      }

      let unsafeRec;
      if (
        options.intrinsics === 'inherit' &&
        options.isDirectEval === 'inherit' &&
        options.transform === 'inherit'
      ) {
        // In "inherit" mode, we create a compartment realm and inherit
        // the context since we share the intrinsics. We create a new
        // set to allow us to define eval() and Function() for the realm.

        // Class constructor only has a [[Construct]] behavior and not
        // a call behavior, therefore the use of "this" cannot be bound
        // by an adversary.
        unsafeRec = RealmProto2UnsafeRec.get(getPrototypeOf(this));
      } else if (
        options.intrinsics === undefined &&
        options.isDirectEval === undefined &&
        options.transform === undefined
      ) {
        // When intrinics are not provided, we create a root realm
        // using the fresh set of new intrinics from a new context.
        unsafeRec = createUnsafeRec(); // this repairs the constructors too
        createRealmFacade(unsafeRec, Realm);
      } else {
        // note this would leak the parent TypeError, from which the child can
        // access .prototype and the parent's intrinsics, except that the Realm
        // facade catches all errors and translates them into local Error types
        throw new TypeError('Realm only supports undefined or "inherited" intrinsics.');
      }
      const sharedIntrinsics = getSharedIntrinsics(unsafeRec.unsafeGlobal);
      const globalObj = getGlobalObject(sharedIntrinsics);

      const realmRec = {
        unsafeRec,
        sharedIntrinsics,
        globalObject: globalObj,
        safeEvaluators: undefined
      };
      Realm2RealmRec.set(O, realmRec);

      createEvaluators(realmRec);
      setDefaultBindings(realmRec);
    }
    get intrinsics() {
      const O = this;
      if (typeof O !== 'object') throw new TypeError();
      if (!Realm2RealmRec.has(O)) throw new TypeError();
      const realmRec = Realm2RealmRec.get(O);
      const intrinsics = realmRec.sharedIntrinsics;
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
      return realmRec.globalObject;
    }
    evaluate(x) {
      const O = this;
      if (typeof O !== 'object') throw new TypeError();
      if (!Realm2RealmRec.has(O)) throw new TypeError();
      const realmRec = Realm2RealmRec.get(O);
      const evaluator = realmRec.safeEvaluators.eval;
      return evaluator(`${x}`);
    }
    static makeRootRealm() {
      return new Realm();
    }
    static makeCompartment() {
      return new Realm({
        transform: 'inherit',
        isDirectEval: 'inherit',
        intrinsics: 'inherit'
      });
    }
  }

  RealmProto2UnsafeRec.set(Realm.prototype, getCurrentUnsafeRec());

  defineProperty(Realm.prototype, Symbol.toStringTag, {
    value: 'function Realm() { [shim code] }',
    writable: false,
    enumerable: false,
    configurable: true
  });

  return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
