(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Realm = factory());
}(this, (function () { 'use strict';

  // Note: do not import anything to this file to prevent using implicit
  // dependencies.

  // buildChildRealm is immediately turned into a string, and this function is
  // never referenced again, because it closes over the wrong intrinsics

  // todo: This function is stringified and evaluated outside of the primal
  // realms and it currently can't contain code coverage metrics.
  /* istanbul ignore next */
  function buildChildRealm({ initRootRealm, initCompartment, getRealmGlobal, realmEvaluate }) {
    // This Object and Reflect are brand new, from a new unsafeRec, so no user
    // code has been run or had a chance to manipulate them. We extract these
    // properties for brevity, not for security. Don't ever run this function
    // *after* user code has had a chance to pollute its environment, or it
    // could be used to gain access to BaseRealm and primal-realm Error
    // objects.
    const { defineProperty } = Object;

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
    function callAndWrapError(target, ...args) {
      try {
        return target(...args);
      } catch (err) {
        if (Object(err) !== err) {
          // err is a primitive value, which is safe to rethrow
          throw err;
        }
        let eName, eMessage, eStack;
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
          eStack = `${err.stack}`;
          // eName/eMessage/eStack are now child-realm primitive strings, and
          // safe to expose
        } catch (ignored) {
          // if err.name.toString() throws, keep the (parent realm) Error away
          // from the child
          throw new Error('unknown error');
        }
        const ErrorConstructor = errorConstructors.get(eName) || Error;
        try {
          throw new ErrorConstructor(eMessage);
        } catch (err2) {
          err2.stack = eStack; // replace with the captured inner stack
          throw err2;
        }
      }
    }

    class Realm {
      static makeRootRealm(...args) {
        const r = new Realm();
        callAndWrapError(initRootRealm, Realm, r, ...args);
        return r;
      }

      static makeCompartment(...args) {
        const r = new Realm();
        callAndWrapError(initCompartment, Realm, r, ...args);
        return r;
      }

      // we omit the constructor because it is empty. All the personalization
      // takes place in one of the two static methods,
      // makeRootRealm/makeCompartment

      get global() {
        // this is safe against being called with strange 'this' because
        // baseGetGlobal immediately does a trademark check (it fails unless
        // this 'this' is present in a weakmap that is only populated with
        // legitimate Realm instances)
        return callAndWrapError(getRealmGlobal, this);
      }

      evaluate(...args) {
        // safe against strange 'this', as above
        return callAndWrapError(realmEvaluate, this, ...args);
      }
    }

    defineProperty(Realm.prototype, 'toString', {
      value: () => 'function Realm() { [shim code] }',
      writable: false,
      enumerable: false,
      configurable: true
    });

    return Realm;
  }

  // the parentheses means we don't bind the 'buildChildRealm' name inside the
  // child's namespace. this would accept an anonymous function declaration.
  // function expression (not a declaration) so it has a completion value.
  const buildChildRealmString = `'use strict'; (${buildChildRealm})`;

  function createRealmFacade(unsafeRec, BaseRealm) {
    const { unsafeEval } = unsafeRec;

    // The BaseRealm is the Realm class created by
    // the shim. It's only valid for the context where
    // it was parsed.

    // The Realm facade is a lightweight class built in the
    // context a different context, that provide a fully
    // functional Realm class using the intrisics
    // of that context.

    // This process is simplified because all methods
    // and properties on a realm instance already return
    // values using the intrinsics of the realm's context.

    // Invoke the BaseRealm constructor with Realm as the prototype.
    return unsafeEval(buildChildRealmString)(BaseRealm);
  }

  // All the following stdlib items have the same name on both our intrinsics
  // object and on the global object. Unlike Infinity/NaN/undefined, these
  // should all be writable and configurable.
  const sharedGlobalPropertyNames = [
    // *** 18.2 Function Properties of the Global Object

    // 'eval', // comes from safeEval instead
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
    // 'Function', // comes from safeFunction instead
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
    // 'SharedArrayBuffer' // removed on Jan 5, 2018
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

    // 'Atomics', // removed on Jan 5, 2018
    'JSON',
    'Math',
    'Reflect',

    // *** Annex B

    'escape',
    'unescape',

    // *** ECMA-402

    'Intl'

    // *** ESNext

    // 'Realm' // Comes from createRealmGlobalObject()
  ];

  function getSharedGlobalDescs(unsafeGlobal) {
    const descriptors = {
      // *** 18.1 Value Properties of the Global Object
      Infinity: { value: Infinity },
      NaN: { value: NaN },
      undefined: { value: undefined }
    };

    for (const name of sharedGlobalPropertyNames) {
      descriptors[name] = {
        // todo: if there's a get/accessor on the global, do we want to invoke
        // it or throw an error?
        // todo: get a descriptor here, so we can check
        value: unsafeGlobal[name],
        writable: true,
        configurable: true
      };
    }

    return descriptors;
  }

  // Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
  // https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
  // https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

  /**
   * Replace the legacy accessors of Object to comply with strict mode
   * and ES2016 semantics, we do this by redefining them while in 'use strict'.
   *
   * todo: list the issues resolved
   *
   * This function can be used in two ways: (1) invoked directly to fix the primal
   * realm's Object.prototype, and (2) converted to a string to be executed
   * inside each new RootRealm to fix their Object.prototypes. Evaluation requires
   * the function to have no dependencies, so don't import anything from the outside.
   */

  // todo: this file should be moved out to a separate repo and npm module.

  // todo: This function is stringified and evaluated outside of the primal
  // realms and it currently can't contain code coverage metrics.
  /* istanbul ignore file */
  function repairAccessors() {
    const {
      defineProperty,
      defineProperties,
      getOwnPropertyDescriptor,
      getPrototypeOf,
      prototype: objectPrototype
    } = Object;

    // On some platforms, the implementation of these functions act as if they are
    // in sloppy mode: if they're invoked badly, they will expose the global object,
    // so we need to repair these for security. Thus it is our responsibility to fix
    // this, and we need to include repairAccessors. E.g. Chrome in 2016.

    try {
      // Verify that the method is not callable.
      // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
      objectPrototype.__lookupGetter__('dummy');
    } catch (ignore) {
      // Throws, no need to patch.
      return;
    }

    function toObject(obj) {
      if (obj === undefined || obj === null) {
        throw new TypeError(`can't convert undefined or null to object`);
      }
      return Object(obj);
    }

    function asPropertyName(obj) {
      if (typeof obj === 'symbol') {
        return obj;
      }
      return `${obj}`;
    }

    function aFunction(obj, accessor) {
      if (typeof obj !== 'function') {
        throw TypeError(`invalid ${accessor} usage`);
      }
      return obj;
    }

    defineProperties(objectPrototype, {
      __defineGetter__: {
        value: function __defineGetter__(prop, func) {
          const O = toObject(this);
          defineProperty(O, prop, {
            get: aFunction(func, 'getter'),
            enumerable: true,
            configurable: true
          });
        }
      },
      __defineSetter__: {
        value: function __defineSetter__(prop, func) {
          const O = toObject(this);
          defineProperty(O, prop, {
            set: aFunction(func, 'setter'),
            enumerable: true,
            configurable: true
          });
        }
      },
      __lookupGetter__: {
        value: function __lookupGetter__(prop) {
          let O = toObject(this);
          prop = asPropertyName(prop);
          let desc;
          while (O && !(desc = getOwnPropertyDescriptor(O, prop))) {
            O = getPrototypeOf(O);
          }
          return desc && desc.get;
        }
      },
      __lookupSetter__: {
        value: function __lookupSetter__(prop) {
          let O = toObject(this);
          prop = asPropertyName(prop);
          let desc;
          while (O && !(desc = getOwnPropertyDescriptor(O, prop))) {
            O = getPrototypeOf(O);
          }
          return desc && desc.set;
        }
      }
    });
  }

  // Adapted from SES/Caja
  // Copyright (C) 2011 Google Inc.
  // https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
  // https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

  /**
   * This block replaces the original Function constructor, and the original
   * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
   * safe replacements that throw if invoked. 
   *
   * These are all reachable via syntax, so it isn't sufficient to just 
   * replace global properties with safe versions. Our main goal is to prevent 
   * access to the Function constructor through these starting points.

   * After this block is done, the originals must no longer be reachable, unless 
   * a copy has been made, and funtions can only be created by syntax (using eval) 
   * or by invoking a previously saved reference to the originals.
   */

  // todo: This function is stringified and evaluated outside of the primal
  // realms and it currently can't contain code coverage metrics.
  /* istanbul ignore file */
  function repairFunctions() {
    const { defineProperty, getPrototypeOf, setPrototypeOf } = Object;

    /**
     * The process to repair constructors:
     * 1. Create an instance of the function by evaluating syntax
     * 2. Obtain the prototype from the instance
     * 3. Create a substitute tamed constructor
     * 4. Replace the original constructor with the tamed constructor
     * 5. Replace tamed constructor prototype property with the original one
     * 6. Replace its [[Prototype]] slot with the tamed constructor of Function
     */
    function repairFunction(name, declaration) {
      let FunctionInstance;
      try {
        // Use Function() because eval() has issues with serializing functions under the esm module.
        // TODO: investigate esm distortion of source code.
        // eslint-disable-next-line no-new-func
        FunctionInstance = Function(`return ${declaration}`)();
      } catch (e) {
        if (e instanceof SyntaxError) {
          // Prevent failure on platforms where async and/or generators are not supported.
          return;
        }
        // Re-throw
        throw e;
      }
      const FunctionPrototype = getPrototypeOf(FunctionInstance);

      // Prevents the evaluation of source when calling constructor on the prototype of functions.
      // eslint-disable-next-line no-new-func
      const TamedFunction = Function('throw new Error("Not available");');
      defineProperty(TamedFunction, 'name', { value: name });

      // (new Error()).constructors does not inherit from Function, because Error
      // was defined before ES6 classes. So we don't need to repair it too.

      // (Error()).constructor inherit from Function, which gets a tamed constructor here.

      // todo: in an ES6 class that does not inherit from anything, what does its
      // constructor inherit from? We worry that it inherits from Function, in
      // which case instances could give access to unsafeFunction. markm says
      // we're fine: the constructor inherits from Object.prototype

      // This line replaces the original constructor in the prototype chain
      // with the tamed one. No copy of the original is peserved.
      defineProperty(FunctionPrototype, 'constructor', { value: TamedFunction });

      // This line sets the tamed constructor's prototype data property to
      // the original one.
      defineProperty(TamedFunction, 'prototype', { value: FunctionPrototype });

      if (TamedFunction !== Function.prototype.constructor) {
        // Ensures that all functions meet "instanceof Function" in a realm.
        setPrototypeOf(TamedFunction, Function.prototype.constructor);
      }
    }

    // Here, the order of operation is important: Function needs to be repaired
    // first since the other repaired constructors need to inherit from the tamed
    // Function function constructor.

    // note: this really wants to be part of the standard, because new
    // constructors may be added in the future, reachable from syntax, and this
    // list must be updated to match.

    repairFunction('Function', '(function(){})');
    // "plain arrow functions" inherit from Function.prototype
    repairFunction('GeneratorFunction', '(function*(){})');
    repairFunction('AsyncFunction', '(async function(){})');
    repairFunction('AsyncGeneratorFunction', '(async function*(){})');
  }

  // Declare shorthand functions. Sharing these declarations across modules
  // improves both consistency and minification. Unused declarations are
  // dropped by the tree shaking process.

  // we capture these, not just for brevity, but for security. If any code
  // modifies Object to change what 'assign' points to, the Realm shim would be
  // corrupted.

  const {
    assign,
    create,
    defineProperties,
    defineProperty,
    freeze,
    getOwnPropertyDescriptor,
    getOwnPropertyDescriptors,
    getOwnPropertyNames,
    getPrototypeOf,
    setPrototypeOf
  } = Object;

  const {
    apply,
    ownKeys // Reflect.ownKeys includes Symbols and unenumerables, unlike Object.keys()
  } = Reflect;

  /**
   * uncurryThis()
   * See http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
   * which only lives at http://web.archive.org/web/20160805225710/http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
   *
   * Performance:
   * 1. The native call is about 10x faster on FF than chrome
   * 2. The version using Function.bind() is about 100x slower on FF, equal on chrome, 2x slower on Safari
   * 3. The version using a spread and Reflect.apply() is about 10x slower on FF, equal on chrome, 2x slower on Safari
   *
   * const bind = Function.prototype.bind;
   * const uncurryThis = bind.bind(bind.call);
   */
  const uncurryThis = fn => (thisArg, ...args) => apply(fn, thisArg, args);

  // We also capture these for security: changes to Array.prototype after the
  // Realm shim runs shouldn't affect subsequent Realm operations.
  const objectHasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty),
    arrayFilter = uncurryThis(Array.prototype.filter),
    arrayPop = uncurryThis(Array.prototype.pop),
    arrayJoin = uncurryThis(Array.prototype.join),
    arrayConcat = uncurryThis(Array.prototype.concat),
    regexpMatch = uncurryThis(RegExp.prototype.match),
    stringIncludes = uncurryThis(String.prototype.includes);

  // this module must never be importable outside the Realm shim itself

  // A "context" is a fresh unsafe Realm as given to us by existing platforms.
  // We need this to implement the shim. However, when Realms land for real,
  // this feature will be provided by the underlying engine instead.

  // Detection used in RollupJS.
  const isNode = typeof exports === 'object' && typeof module !== 'undefined';
  const isBrowser = typeof document === 'object';
  if ((!isNode && !isBrowser) || (isNode && isBrowser)) {
    throw new Error('unexpected platform, unable to create Realm');
  }
  const vm = isNode ? require('vm') : undefined;

  // note: in a node module, the top-level 'this' is not the global object
  // (it's *something* but we aren't sure what), however an indirect eval of
  // 'this' will be the correct global object.

  const unsafeGlobalSrc = "'use strict'; this";
  const unsafeGlobalEvalSrc = `(0, eval)("'use strict'; this")`;

  function createNewUnsafeGlobalForNode() {
    // Use unsafeGlobalEvalSrc to ensure we get the right 'this'.
    const unsafeGlobal = vm.runInNewContext(unsafeGlobalEvalSrc);

    return unsafeGlobal;
  }

  function createNewUnsafeGlobalForBrowser() {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';

    document.body.appendChild(iframe);
    const unsafeGlobal = iframe.contentWindow.eval(unsafeGlobalSrc);

    // We keep the iframe attached to the DOM because removing it
    // causes its global object to lose intrinsics, its eval()
    // function to evaluate code, etc.

    // TODO: can we remove and garbage-collect the iframes?

    return unsafeGlobal;
  }

  // we only export this so test-repair.js can get an unrepaired
  // Object.prototype, to sense if this platform has the buggy behavior
  const getNewUnsafeGlobal = isNode
    ? createNewUnsafeGlobalForNode
    : createNewUnsafeGlobalForBrowser;

  // The unsafeRec is shim-specific. It acts as the mechanism to obtain a fresh
  // set of intrinsics together with their associated eval and Function
  // evaluators. These must be used as a matched set, since the evaluators are
  // tied to a set of intrinsics, aka the "undeniables". If it were possible to
  // mix-and-match them from different contexts, that would enable some
  // attacks.
  function createUnsafeRec(unsafeGlobal, allShims) {
    const sharedGlobalDescs = getSharedGlobalDescs(unsafeGlobal);

    return freeze({
      unsafeGlobal,
      sharedGlobalDescs,
      unsafeEval: unsafeGlobal.eval,
      unsafeFunction: unsafeGlobal.Function,
      allShims
    });
  }

  const repairAccessorsShim = `"use strict"; (${repairAccessors})();`;
  const repairFunctionsShim = `"use strict"; (${repairFunctions})();`;

  // Create a new unsafeRec from a brand new context, with new intrinsics and a
  // new global object
  function createNewUnsafeRec(allShims) {
    const unsafeGlobal = getNewUnsafeGlobal();
    unsafeGlobal.eval(repairAccessorsShim);
    unsafeGlobal.eval(repairFunctionsShim);
    return createUnsafeRec(unsafeGlobal, allShims);
  }

  // Create a new unsafeRec from the current context, where the Realm shim is
  // being parsed and executed, aka the "Primal Realm"
  function createCurrentUnsafeRec() {
    const unsafeGlobal = (0, eval)(unsafeGlobalSrc);
    repairAccessors();
    repairFunctions();
    return createUnsafeRec(unsafeGlobal, []);
  }

  // the ScopeHandler manages a Proxy which serves as the global scope for the

  class ScopeHandler {
    // Properties stored on the handler are not available from the proxy.

    // the Proxy is only used by with(), so the Handler only needs to implement
    // a few properties: has, get, set (which we leave at the default)

    // todo: throw if any traps other than get/set/has are run (e.g.
    // getOwnPropertyDescriptors, apply, getPrototypeOf) . Make this handler
    // inherit from a second one whose 'get' property always throws.

    constructor(unsafeRec) {
      this.unsafeGlobal = unsafeRec.unsafeGlobal;
      this.unsafeEval = unsafeRec.unsafeEval;

      // this flag allow us to determine if the eval() call is a controlled
      // eval done by the realm's code or if it is user-land invocation, so
      // we can react differently.
      this.useUnsafeEvaluator = false;

      // todo: this.shadowTarget = getPrototypeOf(somehow_get_target)
    }

    get(target, prop) {
      // Special treatment for eval. The very first lookup of 'eval' gets the
      // unsafe (real direct) eval, so it will get the lexical scope that uses
      // the 'with' context.
      if (prop === 'eval') {
        // test that it is true rather than merely truthy
        if (this.useUnsafeEvaluator === true) {
          // reset before use
          this.useUnsafeEvaluator = false;
          return this.unsafeEval;
        }
        return target.eval;
      }

      // todo: shim integrity, capture Symbol.unscopables
      if (prop === Symbol.unscopables) {
        // Safe to return a primal realm Object here because the only code that
        // can do a get() on a non-string is the internals of with() itself,
        // and the only thing it does is to look for properties on it. User
        // code cannot do a lookup on non-strings.
        return undefined;
      }

      // Properties of the global.
      if (prop in target) {
        return target[prop];
      }
      // Prevent the lookup for other properties.
      return undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    set(target, prop, value) {
      // Set the value on the shadow. The target itself is an empty
      // object that is only used to prevent a frozen eval property.
      // todo: use this.shadowTarget, for speedup

      // new todo: allow modifications when target.hasOwnProperty(prop) and it
      // is writable, assuming we've already rejected overlap (see
      // createSafeEvaluatorFactory.factory). This TypeError gets replaced with
      // target[prop] = value
      if (objectHasOwnProperty(target, prop)) {
        // todo: shim integrity: TypeError, String
        throw new TypeError(`do not modify endowments like ${String(prop)}`);
      }
      getPrototypeOf(target)[prop] = value;
      // Return true after successful set.
      return true;
    }

    // we need has() to return false for some names to prevent the lookup  from
    // climbing the scope chain and eventually reaching the unsafeGlobal
    // object, which is bad.

    // note: unscopables! every string in Object[Symbol.unscopables]

    // todo: we'd like to just have has() return true for everything, and then
    // use get() to raise a ReferenceError for anything not on the safe global.
    // But we want to be compatible with ReferenceError in the normal case and
    // the lack of ReferenceError in the 'typeof' case. Must either reliably
    // distinguish these two cases (the trap behavior might be different), or
    // we rely on a mandatory source-to-source transform to change 'typeof abc'
    // to XXX. We already need a mandatory parse to prevent the 'import' and
    // 'import.meta' expressions, since they're special forms instead of merely
    // being a global variable

    // note: if we make has() return true always, then we must implement a
    // set() trap to avoid subverting the protection of strict mode (it would
    // accept assignments to undefined globals, when it ought to throw
    // ReferenceError for such assignments)

    has(target, prop) {
      // proxies stringify 'prop', so no TOCTTOU danger here
      if (prop === 'eval') {
        return true;
      }
      if (prop === 'arguments') {
        return false;
      }
      if (prop in target) {
        return true;
      }
      // hide all properties of unsafeGlobal at the expense of 'typeof' being
      // wrong for those properties
      if (prop in this.unsafeGlobal) {
        // in browser, 'document = 3', this will add a property to your safeGlobal
        return true;
      }
      return false;
    }
  }

  // this \s *must* match all kinds of syntax-defined whitespace. If e.g.
  // U+2028 (LINE SEPARATOR) or U+2029 (PARAGRAPH SEPARATOR) is treated as
  // whitespace by the parser, but not matched by /\s/, then this would admit
  // an attack like: import\u2028('power.js') . We're trying to distinguish
  // something like that from something like importnotreally('power.js') which
  // is perfectly safe.

  const scanner = /^(.*)\bimport\s*(\(|\/\/|\/\*)/m;

  function rejectImportExpressions(s) {
    const matches = scanner.exec(s);
    if (matches) {
      // todo: if we have a full parser available, use it here. If there is no
      // 'import' token in the string, we're safe.
      // if (!parse(s).contains('import')) return;
      const linenum = matches[1].split('\n').length; // more or less
      throw new SyntaxError(`possible import expression rejected around line ${linenum}`);
    }
  }

  // we'd like to abandon, but we can't, so just scream and break a lot of
  // stuff. However, since we aren't really aborting the process, be careful to
  // not throw an Error object which could be captured by child-Realm code and
  // used to access the (too-powerful) primal-realm Error object.

  function throwTantrum(s, err = undefined) {
    const msg = `please report internal shim error: ${s}`;

    // note: we really do want to log these 'should never happen' things. there
    // might be a better way to convince the linter, though.
    // eslint-disable-next-line no-console
    console.error(msg);
    if (err) {
      // eslint-disable-next-line no-console
      console.error(`${err}`);
      // eslint-disable-next-line no-console
      console.error(`${err.stack}`);
    }

    // eslint-disable-next-line no-debugger
    debugger;
    throw msg;
  }

  function assert(condition, message) {
    if (!condition) {
      throwTantrum(`failed to: ${message}`);
    }
  }

  // Portions adapted from V8 - Copyright 2016 the V8 project authors.

  // admit many (but not all) legal variable names: starts with letter/_/$,
  // continues with letter/digit/_/$ . It will reject many legal names that
  // involve unicode characters. We use 'apply' rather than /../.match() in
  // case RegExp has been poisoned.
  const identifierPattern = /^[a-zA-Z_$][\w_$]*$/;

  // todo: think about how this interacts with endowments, check for conflicts
  // between the names being optimized and the ones added by endowments

  function getOptimizableGlobals(safeGlobal) {
    const descs = getOwnPropertyDescriptors(safeGlobal);

    const constants = arrayFilter(getOwnPropertyNames(descs), name => {
      // Ensure we have a valid identifier.
      // getOwnPropertyNames does ignore Symbols so we don't need this extra check:
      // typeof name === 'string' &&
      if (!regexpMatch(identifierPattern, name)) {
        return false;
      }

      const desc = descs[name];
      return (
        //
        // getters will not have .writable, don't let the falsyness of
        // 'undefined' trick us: test with === false, not ! . However descriptors
        // inherit from the (potentially poisoned) global object, so we might see
        // extra properties which weren't really there. Accessor properties have
        // 'get/set/enumerable/configurable', while data properties have
        // 'value/writable/enumerable/configurable'.
        desc.configurable === true &&
        desc.writable === true &&
        //
        // Check for accessor properties: we don't want to optimize these,
        // they're obviously non-constant. Value properties can't have
        // accessors at the same time, so this check is sufficient.
        'value' in desc
      );
    });

    return constants;
  }

  function buildOptimizer(constants) {
    if (constants.length === 0) return '';
    return `const {${arrayJoin(constants, ',')}} = arguments[0];`;
  }

  function createScopedEvaluatorFactory(unsafeRec, constants) {
    const { unsafeFunction } = unsafeRec;

    const optimizer = buildOptimizer(constants);

    // Create a function in sloppy mode, so that we can use 'with'. It returns
    // a function in strict mode that evaluates the provided code using direct
    // eval, and thus in strict mode in the same scope. We must be very careful
    // to not create new names in this scope

    // 1: we use 'with' (around a Proxy) to catch all free variable names. The
    // first 'arguments[0]' holds the Proxy which safely wraps the safeGlobal
    // 2: 'optimizer' catches common variable names for speed
    // 3: The inner strict function is effectively passed two parameters:
    //    a) its arguments[0] is the source to be directly evaluated.
    //    b) its 'this' is the this binding seen by the code being directly evaluated.

    // everything in the 'optimizer' string is looked up in the proxy
    // (including an 'arguments[0]', which points at the Proxy). 'function' is
    // a keyword, not a variable, so it is not looked up. then 'eval' is looked
    // up in the proxy, that's the first time it is looked up after
    // useUnsafeEvaluator is turned on, so the proxy returns the real the
    // unsafeEval, which satisfies the IsDirectEvalTrap predicate, so it uses
    // the direct eval and gets the lexical scope. The second 'arguments[0]' is
    // looked up in the context of the inner function. The *contents* of
    // arguments[0], because we're using direct eval, are looked up in the
    // Proxy, by which point the useUnsafeEvaluator switch has been flipped
    // back to 'false', so any instances of 'eval' in that string will get the
    // safe evaluator.

    // todo: This function is stringified and evaluated outside of the primal
    // realms and it currently can't contain code coverage metrics.
    /* istanbul ignore next */
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

  function createSafeEvaluatorFactory(unsafeRec, safeGlobal) {
    const { unsafeFunction } = unsafeRec;

    const scopeHandler = new ScopeHandler(unsafeRec);
    const optimizableGlobals = getOptimizableGlobals(safeGlobal);
    const scopedEvaluatorFactory = createScopedEvaluatorFactory(unsafeRec, optimizableGlobals);

    function factory(endowments) {
      // todo (shim limitation): scan endowments, throw error if endowment
      // overlaps with the const optimization (which would otherwise
      // incorrectly shadow endowments), or if endowments includes 'eval'. Also
      // prohibit accessor properties (to be able to consistently explain
      // things in terms of shimming the global lexical scope).
      // writeable-vs-nonwritable == let-vs-const, but there's no
      // global-lexical-scope equivalent of an accessor, outside what we can
      // explain/spec
      const scopeTarget = create(safeGlobal, getOwnPropertyDescriptors(endowments));
      const scopeProxy = new Proxy(scopeTarget, scopeHandler);
      const scopedEvaluator = scopedEvaluatorFactory(scopeProxy);

      // We use the the concise method syntax to create an eval without a
      // [[Construct]] behavior (such that the invocation "new eval()" throws
      // TypeError: eval is not a constructor"), but which still accepts a
      // 'this' binding.
      const safeEval = {
        eval(src) {
          src = `${src}`;
          rejectImportExpressions(src);
          scopeHandler.useUnsafeEvaluator = true;
          let err;
          try {
            // Ensure that "this" resolves to the safe global.
            return apply(scopedEvaluator, safeGlobal, [src]);
          } catch (e) {
            // stash the child-code error in hopes of debugging the internal failure
            err = e;
            throw e;
          } finally {
            // belt and suspenders: the proxy switches this off immediately after
            // the first access, but just in case we clear it here too
            if (scopeHandler.useUnsafeEvaluator !== false) {
              scopeHandler.useUnsafeEvaluator = false;
              throwTantrum('handler sets useUnsafeEvaluator = false', err);
            }
          }
        }
      }.eval;

      // safeEval's prototype is currently the primal realm's
      // Function.prototype, which we must not let escape. To make 'eval
      // instanceof Function' be true inside the realm, we need to point it at
      // the RootRealm's value.

      // Ensure that eval from any compartment in a root realm is an instance
      // of Function in any compartment of the same root realm.
      setPrototypeOf(safeEval, unsafeFunction.prototype);

      assert(getPrototypeOf(safeEval).constructor !== Function, 'hide Function');
      assert(getPrototypeOf(safeEval).constructor !== unsafeFunction, 'hide unsafeFunction');

      // note: be careful to not leak our primal Function.prototype by setting
      // this to a plain arrow function. Now that we have safeEval, use it.
      defineProperty(safeEval, 'toString', {
        value: safeEval("() => 'function eval() { [shim code] }'"),
        writable: false,
        enumerable: false,
        configurable: true
      });

      return safeEval;
    }

    return factory;
  }

  function createSafeEvaluator(safeEvaluatorFactory) {
    return safeEvaluatorFactory({});
  }

  function createSafeEvaluatorWhichTakesEndowments(safeEvaluatorFactory) {
    return (x, endowments) => safeEvaluatorFactory(endowments)(x);
  }

  /**
   * A safe version of the native Function which relies on
   * the safety of evalEvaluator for confinement.
   */
  function createFunctionEvaluator(unsafeRec, safeEval) {
    const { unsafeFunction, unsafeGlobal } = unsafeRec;

    const safeFunction = function Function(...params) {
      const functionBody = `${arrayPop(params) || ''}`;
      let functionParams = `${arrayJoin(params, ',')}`;

      // Is this a real functionBody, or is someone attempting an injection
      // attack? This will throw a SyntaxError if the string is not actually a
      // function body. We coerce the body into a real string above to prevent
      // someone from passing an object with a toString() that returns a safe
      // string the first time, but an evil string the second time.
      // eslint-disable-next-line no-new, new-cap
      new unsafeFunction(functionBody);

      if (stringIncludes(functionParams, ')')) {
        // If the formal parameters string include ) - an illegal
        // character - it may make the combined function expression
        // compile. We avoid this problem by checking for this early on.

        // note: v8 throws just like this does, but chrome accepts e.g. 'a = new Date()'
        throw new unsafeGlobal.SyntaxError(
          'shim limitation: Function arg string contains parenthesis'
        );
        // todo: shim integrity threat if they change SyntaxError
      }

      // todo: check to make sure this .length is safe. markm says safe.
      if (functionParams.length > 0) {
        // If the formal parameters include an unbalanced block comment, the
        // function must be rejected. Since JavaScript does not allow nested
        // comments we can include a trailing block comment to catch this.
        functionParams += '\n/*``*/';
      }

      const src = `(function(${functionParams}){\n${functionBody}\n})`;

      return safeEval(src);
    };

    // Ensure that Function from any compartment in a root realm can be used
    // with instance checks in any compartment of the same root realm.
    setPrototypeOf(safeFunction, unsafeFunction.prototype);

    assert(getPrototypeOf(safeFunction).constructor !== Function, 'hide Function');
    assert(getPrototypeOf(safeFunction).constructor !== unsafeFunction, 'hide unsafeFunction');

    // Ensure that any function created in any compartment in a root realm is an
    // instance of Function in any compartment of the same root ralm.
    defineProperty(safeFunction, 'prototype', { value: unsafeFunction.prototype });

    // Provide a custom output without overwriting the Function.prototype.toString
    // which is called by some third-party libraries.
    defineProperty(safeFunction, 'toString', {
      value: safeEval("() => 'function Function() { [shim code] }'"),
      writable: false,
      enumerable: false,
      configurable: true
    });

    return safeFunction;
  }

  // Create a registry to mimic a private static members on the realm classes.
  // We define it in the same module and do not export it.

  const UnsafeRecForRealmClass = new WeakMap();

  function getUnsafeRecForRealmClass(RealmClass) {
    if (Object(RealmClass) !== RealmClass) {
      // Detect non-objects.
      throw new TypeError('internal error: bad object, not a Realm constructor');
    }
    // spec just says throw TypeError
    // todo: but shim should include a message
    if (!UnsafeRecForRealmClass.has(RealmClass)) {
      // RealmClass has no unsafeRec. Shoud not proceed.
      throw new TypeError('internal error: bad object');
    }
    return UnsafeRecForRealmClass.get(RealmClass);
  }

  function registerUnsafeRecForRealmClass(RealmClass, unsafeRec) {
    if (Object(RealmClass) !== RealmClass) {
      // Detect non-objects.
      throw new TypeError('internal error: bad object, not a Realm constructor');
    }
    // spec just says throw TypeError
    // todo: but shim should include a message
    if (UnsafeRecForRealmClass.has(RealmClass)) {
      // Attempt to change an existing unsafeRec on a Realm. Shoud not proceed.
      throw new TypeError('internal error: bad object');
    }
    UnsafeRecForRealmClass.set(RealmClass, unsafeRec);
  }

  // Create a registry to mimic a private members on the realm imtances.
  // We define it in the same module and do not export it.

  const RealmRecForRealmInstance = new WeakMap();

  function getRealmRecForRealmInstance(realm) {
    if (Object(realm) !== realm) {
      // Detect non-objects.
      throw new TypeError('bad object, not a Realm instance');
    }
    if (!RealmRecForRealmInstance.has(realm)) {
      // Realm instance has no realmRec. Should not proceed.
      throw new TypeError(
        'bad object, use Realm.makeRootRealm() or .makeCompartment() instead of "new Realm"'
      );
    }
    return RealmRecForRealmInstance.get(realm);
  }

  function registerRealmRecForRealmInstance(realm, realmRec) {
    if (Object(realm) !== realm) {
      // Detect non-objects.
      throw new TypeError('internal error: bad object, not a Realm instance');
    }
    if (RealmRecForRealmInstance.has(realm)) {
      // Attempt to change an existing realmRec on a realm instance. Should not proceed.
      throw new TypeError('internal error: Realm instance is already present');
    }
    RealmRecForRealmInstance.set(realm, realmRec);
  }

  // Initialize the global variables for the new Realm.
  function setDefaultBindings(sharedGlobalDescs, safeGlobal, safeEval, safeFunction) {
    defineProperties(safeGlobal, sharedGlobalDescs);

    defineProperty(safeGlobal, 'eval', {
      value: safeEval,
      writable: true,
      configurable: true
    });

    defineProperty(safeGlobal, 'Function', {
      value: safeFunction,
      writable: true,
      configurable: true
    });
  }

  function createRealmRec(unsafeRec) {
    const { sharedGlobalDescs, unsafeGlobal } = unsafeRec;

    const safeGlobal = create(unsafeGlobal.Object.prototype);
    const safeEvaluatorFactory = createSafeEvaluatorFactory(unsafeRec, safeGlobal);
    const safeEval = createSafeEvaluator(safeEvaluatorFactory);
    const safeEvalWhichTakesEndowments = createSafeEvaluatorWhichTakesEndowments(
      safeEvaluatorFactory
    );
    const safeFunction = createFunctionEvaluator(unsafeRec, safeEval);

    setDefaultBindings(sharedGlobalDescs, safeGlobal, safeEval, safeFunction);

    const realmRec = freeze({
      safeGlobal,
      safeEval,
      safeEvalWhichTakesEndowments,
      safeFunction
    });

    return realmRec;
  }

  function initRootRealm(selfClass, self, options) {
    options = Object(options); // Todo: sanitize
    // note: 'self' is the instance of the Realm, and 'selfClass' is the
    // Realm constructor (facade) we build in buildChildRealm().

    // In 'undefined' mode, intrinics are not provided, we create a root
    // realm using the fresh set of new intrinics from a new context.

    // todo: investigate attacks via Array.species
    const newShims = options.shims || [];
    const { allShims: oldShims } = getUnsafeRecForRealmClass(selfClass);
    // todo: this accepts newShims='string', but it should reject that
    const allShims = arrayConcat(oldShims, newShims);

    // The unsafe record is returned with its constructors repaired.
    const unsafeRec = createNewUnsafeRec(allShims);

    // Define Realm onto new sharedGlobalDescs, so it can be copied onto the
    // safeGlobal like the rest of the .
    // eslint-disable-next-line no-use-before-define
    const Realm = createRealmGlobalObject(unsafeRec);
    registerUnsafeRecForRealmClass(Realm, unsafeRec);

    const realmRec = createRealmRec(unsafeRec);
    registerRealmRecForRealmInstance(self, realmRec);
    // Now run all shims in the new RootRealm. We don't do this for
    // compartments
    for (const shim of allShims) {
      // eslint-disable-next-line no-use-before-define
      realmEvaluate(self, shim);
    }
  }

  function initCompartment(selfClass, self) {
    // note: 'self' is the instance of the Realm, and 'selfClass' is the
    // Realm constructor (facade) we build in buildChildRealm().

    // In "inherit" mode, we create a compartment realm and inherit
    // the context since we share the intrinsics. We create a new
    // set to allow us to define eval() and Function() for the realm.
    const unsafeRec = getUnsafeRecForRealmClass(selfClass);

    const realmRec = createRealmRec(unsafeRec);
    registerRealmRecForRealmInstance(self, realmRec);
  }

  function getRealmGlobal(self) {
    const { safeGlobal } = getRealmRecForRealmInstance(self);
    return safeGlobal;
  }

  function realmEvaluate(self, x, endowments = {}) {
    // todo: don't pass in primal-realm objects like {}, for safety. OTOH its
    // properties are copied onto the new global 'target'.
    // todo: figure out a way to membrane away the contents to safety.
    const { safeEvalWhichTakesEndowments } = getRealmRecForRealmInstance(self);
    return safeEvalWhichTakesEndowments(x, endowments);
  }

  // Define Realm onto new sharedGlobalDescs, so it can be defined in the
  // safeGlobal like the rest of the shared globals.
  function createRealmGlobalObject(unsafeRec) {
    const Realm = createRealmFacade(unsafeRec, {
      initRootRealm,
      initCompartment,
      getRealmGlobal,
      realmEvaluate
    });
    unsafeRec.sharedGlobalDescs.Realm = {
      value: Realm,
      writable: true,
      configurable: true
    };
    return Realm;
  }

  // Create the current unsafeRec from the current "primal" realm (the realm
  // where the Realm shim is loaded and executed).
  const currentUnsafeRec = createCurrentUnsafeRec();
  const Realm = createRealmFacade(currentUnsafeRec, {
    initRootRealm,
    initCompartment,
    getRealmGlobal,
    realmEvaluate
  });
  registerUnsafeRecForRealmClass(Realm, currentUnsafeRec);

  return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
