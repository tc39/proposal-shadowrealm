(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Realm = factory());
}(this, (function () { 'use strict';

  // Note: do not import anything to this file to prevent using implicit
  // dependencies.

  // buildChildRealm is immediately turned into a string, and this function is
  // never referenced again, because it closes over the wrong intrinsics

  function buildChildRealm(BaseRealm) {
    const { defineProperty, getOwnPropertyDescriptors } = Object;
    const { apply, construct } = Reflect;

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
    function applyAndWrapError(target, thisArgument, ...args) {
      try {
        return apply(target, thisArgument, args);
      } catch (err) {
        if (Object(err) !== err) {
          // err is a primitive value, which is safe to rethrow
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
        } catch (ignored) {
          // if err.name.toString() throws, keep the (parent realm) Error away
          // from the child
          throw new Error('unknown error');
        }
        const ErrorConstructor = errorConstructors.get(eName) || Error;
        // note: this drops the stack trace. todo: stringify and copy
        throw new ErrorConstructor(eMessage);
      }
    }

    const descs = getOwnPropertyDescriptors(BaseRealm.prototype);
    // eslint-disable-next-line camelcase
    const descs_global_get = descs.global.get;
    // eslint-disable-next-line camelcase
    const descs_evaluate_value = descs.evaluate.value;

    class Realm {
      constructor(...args) {
        return applyAndWrapError(construct, undefined, BaseRealm, args, Realm);
      }
      get global() {
        return applyAndWrapError(descs_global_get, this);
      }
      evaluate(...args) {
        return applyAndWrapError(descs_evaluate_value, this, args);
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

  // See http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
  // which only lives at http://web.archive.org/web/20160805225710/http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
  const bind = Function.prototype.bind;
  const uncurryThis = bind.bind(bind.call);

  // We also capture these for security: changes to Array.prototype after the
  // Realm shim runs shouldn't affect subsequent Realm operations.
  const objectHasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty),
    arrayPush = uncurryThis(Array.prototype.push),
    arrayPop = uncurryThis(Array.prototype.pop),
    arrayJoin = uncurryThis(Array.prototype.join),
    regexpMatch = uncurryThis(RegExp.prototype.match),
    stringIncludes = uncurryThis(String.prototype.includes);

  // Adapted from SES/Caja - Copyright (C) 2011 Google Inc.

  // TOCTTOU and .asString() games could enable attacker to skip some
  // intermediate ancestors, so we stringify/propify this once, first.
  function asPropertyName(prop) {
    if (typeof prop === 'symbol') {
      return prop;
    }
    return `${prop}`;
  }

  /**
   * Replace the legacy accessors of Object to comply with strict mode
   * and ES2016 semantics, we do this by redefining them while in 'use strict'
   * https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__

  We need this repair, but would it be included when the real realms is
  integrated into the language. If not, what are we getting here?

  Also note that this changes the primal versions.

  On some platforms, the implementation of these functions act as if they are
  in sloppy mode: if they're invoked badly, they will expose the global object,
  so we need to repair these for security. Thus it is our responsibility to fix
  this, and we need to include repairAccessors. E.g. Chrome in 2016.

  todo: It would be better to detect and only repair the functions that have
  the bug.

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
          prop = asPropertyName(prop); // sanitize property name/symbol
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
          prop = asPropertyName(prop); // sanitize property name/symbol
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
   * 1. Obtain the prototype from an instance of the syntax
   * 2. Create a substitute noop constructor
   * 3. Replace its prototype property with the original prototype
   * 4. Replace its prototype property's constructor with itself
   * 5. Replace its [[Prototype]] slot with the noop constructor of Function
   */
  function repairFunction(unsafeRec, functionName, functionDecl) {
    const { unsafeEval, unsafeFunction, unsafeGlobal } = unsafeRec;

    let FunctionInstance;
    try {
      // todo: pass the whole functionDecl in, rather than building a template
      // around it, make this look like createOptionalSyntax in intrinsics.js
      FunctionInstance = unsafeEval(functionDecl); // step 1
    } catch (e) {
      if (e instanceof unsafeGlobal.SyntaxError) {
        // Prevent failure on platforms where generators are not supported.
        return;
      }
      // Re-throw
      throw e;
    }
    const FunctionPrototype = getPrototypeOf(FunctionInstance);

    // Block evaluation of source when calling constructor on the prototype of functions.
    const TamedFunction = unsafeFunction('throw new Error("Not available");');
    // (new Error()).constructor does not inherit from Function, because Error
    // was defined before ES6 classes. So we don't need to repair it too.
    // todo: what about (Error()).constructor ?

    // todo: in an ES6 class that does not inherit from anything, what does its
    // constructor inherit from? We worry that it inherits from Function, in
    // which case instances could give access to unsafeFunction. markm says
    // we're fine: the constructor inherits from Object.prototype

    defineProperties(TamedFunction, {
      name: {
        value: functionName
      },
      prototype: {
        value: FunctionPrototype
      }
    });
    defineProperty(FunctionPrototype, 'constructor', { value: TamedFunction });

    if (TamedFunction !== unsafeFunction.prototype.constructor) {
      // Ensures that all functions meet "instanceof Function" in a realm.
      setPrototypeOf(TamedFunction, unsafeFunction.prototype.constructor);
    }
  }

  /**
   * This block replaces the original Function constructor, and the original
   * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
   * safe replacements that preserve SES confinement. After this block is done,
   * the originals must no longer be reachable.
   */
  function repairFunctions(unsafeRec) {
    // Here, the order of operation is important: Function needs to be repaired
    // first since the other constructors need it. Note these are all reachable
    // via syntax, so it isn't sufficient to just replace global properties
    // with safe versions. Our main goal is to prevent access to the
    // unsafeFunction constructor through these starting points.
    repairFunction(unsafeRec, 'Function', '(function(){})');
    // "plain arrow functions" inherit from Function.prototype
    repairFunction(unsafeRec, 'GeneratorFunction', '(function*(){})');
    repairFunction(unsafeRec, 'AsyncFunction', '(async function(){})');
    repairFunction(unsafeRec, 'AsyncGeneratorFunction', '(async function*(){})');
  }
  // note: this really wants to be part of the standard, because new
  // constructors may be added in the future, reachable from syntax, and this
  // list must be updated to match

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
    // todo: we keep the iframe attached. At one point, removing the iframe
    // caused its global object to lose its intrinsics. todo: re-test this.

    return unsafeGlobal;
  }

  const getNewUnsafeGlobal = isNode ? createNewUnsafeGlobalForNode : createNewUnsafeGlobalForBrowser;

  // The unsafeRec is shim-specific. It acts as the mechanism to obtain a fresh
  // set of intrinsics together with their associated eval and Function
  // evaluators. These must be used as a matched set, since the evaluators are
  // tied to a set of intrinsics, aka the "undeniables". If it were possible to
  // mix-and-match them from different contexts, that would enable some
  // attacks.
  function createUnsafeRec(unsafeGlobal) {
    const sharedGlobalDescs = getSharedGlobalDescs(unsafeGlobal);

    return freeze({
      unsafeGlobal,
      sharedGlobalDescs,
      unsafeEval: unsafeGlobal.eval,
      unsafeFunction: unsafeGlobal.Function
    });
  }

  // todo: NEEDS COMMENT
  function sanitizeUnsafeRec(unsafeRec) {
    // Ensures that neither the legacy accessors nor the function constructors
    // can be used to escape the confinement of the evaluators to execute in the
    // context.
    repairAccessors(unsafeRec);
    repairFunctions(unsafeRec);
  }

  // Create a new unsafeRec from a brand new context, with new intrinsics and a
  // new global object
  function createNewUnsafeRec() {
    const unsafeGlobal = getNewUnsafeGlobal();
    const unsafeRec = createUnsafeRec(unsafeGlobal);
    sanitizeUnsafeRec(unsafeRec);
    return unsafeRec;
  }

  // Create a new unsafeRec from the current context, where the Realm shim is
  // being parsed and executed, aka the "Primal Realm"
  function createCurrentUnsafeRec() {
    const unsafeGlobal = (0, eval)(unsafeGlobalSrc);
    const unsafeRec = createUnsafeRec(unsafeGlobal);
    sanitizeUnsafeRec(unsafeRec);
    return unsafeRec;
  }

  // todo needs comment

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
      // object that is only used to prevent a froxen eval property.
      // todo: use this.shadowTarget, for speedup
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

  // we'd like to abandon, but we can't, so just scream and break a lot of
  // stuff. However, since we aren't really aborting the process, be careful to
  // not throw an Error object which could be captured by child-Realm code and
  // used to access the (too-powerful) primal-realm Error object.

  function throwTantrum(s, err = undefined) {
    const msg = `please report internal shim error: ${s}`;
    // note: we really do want to log these 'should never happen' things. there
    // might be a better way to convince the linter, though.
    // eslint-disable-next-line no-console
    console.log(msg);
    if (err) {
      // eslint-disable-next-line no-console
      console.log(`${err}`);
      // eslint-disable-next-line no-console
      console.log(`${err.stack}`);
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

  const identifierPattern = /^[a-zA-Z_$][\w_$]*$/;

  function getOptimizableGlobals(safeGlobal) {
    const constants = [];
    const descs = getOwnPropertyDescriptors(safeGlobal);

    for (const name of getOwnPropertyNames(descs)) {
      const desc = descs[name];
      if (typeof name !== 'string') continue; // ignore Symbols

      // admit many (but not all) legal variable names: starts with letter/_/$,
      // continues with letter/digit/_/$ . It will reject many legal names that
      // involve unicode characters. We use 'apply' rather than /../.match() in
      // case RegExp has been poisoned.

      if (!regexpMatch(identifierPattern, name)) continue;

      // getters will not have .writable, don't let the falsyness of
      // 'undefined' trick us: test with === false, not ! . However descriptors
      // inherit from the (potentially poisoned) global object, so we might see
      // extra properties which weren't really there. Accessor properties have
      // 'get/set/enumerable/configurable', while data properties have
      // 'value/writable/enumerable/configurable'.

      if (desc.configurable !== false) continue;
      if (desc.writable !== false) continue;

      // Check for accessor properties: we don't want to optimize these,
      // they're obviously non-constant. Setter-only accessors will still have
      // a 'get' property, but it will be 'undefined', so we only have to test
      // for 'get', not 'set'
      if ('get' in desc) continue;
      if ('set' in desc) continue;

      // protect against post-initialization corruption of primal realm Array
      arrayPush(constants, name);
    }
    return constants;
  }

  function buildOptimizer(constants) {
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

  function createSafeEvaluator(unsafeRec, safeGlobal) {
    const { unsafeFunction } = unsafeRec;

    // This proxy has several functions:
    // 1. works with the sentinel to alternate between direct eval and confined eval.
    // 2. shadows all properties of the unsafe global by declaring them as undefined.
    // 3. resolves all existing properties of the safe global.
    // 4. uses an empty object as the target, with the safe global as its prototype,
    // to bypass a proxy invariant that would prevent alternating between different
    // values of eval if the user was to freeze the eval property on the safe global.
    const scopeHandler = new ScopeHandler(unsafeRec);
    const scopeTarget = create(safeGlobal);
    const scopeProxy = new Proxy(scopeTarget, scopeHandler);

    const optimizableGlobals = getOptimizableGlobals(safeGlobal);
    const scopedEvaluatorFactory = createScopedEvaluatorFactory(unsafeRec, optimizableGlobals);
    const scopedEvaluator = scopedEvaluatorFactory(scopeProxy);

    // We use the the concise method syntax to create an eval without a
    // [[Construct]] behavior (such that the invocation "new eval()" throws
    // TypeError: eval is not a constructor"), but which still accepts a 'this'
    // binding.
    const safeEval = {
      eval(src) {
        src = `${src}`;
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

    // safeEval's prototype is currently the primal realm's Function.prototype,
    // which we must not let escape. To make 'eval instanceof Function' be true
    // inside the realm, we need to point it at the RootRealm's value.

    // Ensure that eval from any compartment in a root realm is an
    // instance of Function in any compartment of the same root realm.
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

  /**
   * A safe version of the native Function which relies on
   * the safety of evalEvaluator for confinement.
   */
  function createFunctionEvaluator(unsafeRec, safeEval) {
    const { unsafeFunction, unsafeGlobal } = unsafeRec;

    const safeFunction = function Function(...params) {
      const functionBody = `${arrayPop(params)}` || '';
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
    // todo: write a test case

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

  const UnsafeRecForRealm = new WeakMap();

  function getUnsafeRecForRealm(Realm) {
    if (Object(Realm) !== Realm) {
      // Detect non-objects.
      throw new TypeError();
    }
    // spec just says throw TypeError
    // todo: but shim should include a message
    if (!UnsafeRecForRealm.has(Realm)) {
      // Realm has no unsafeRec. Shoud not proceed.
      throw new TypeError();
    }
    return UnsafeRecForRealm.get(Realm);
  }

  function registerUnsafeRecForRealm(Realm, unsafeRec) {
    if (Object(Realm) !== Realm) {
      // Detect non-objects.
      throw new TypeError();
    }
    // spec just says throw TypeError
    // todo: but shim should include a message
    if (UnsafeRecForRealm.has(Realm)) {
      // Attempt to change an existing unsafeRec on a Realm. Shoud not proceed.
      throw new TypeError(); // todo error string on all of these
    }
    UnsafeRecForRealm.set(Realm, unsafeRec);
  }

  // Create a registry to mimic a private members on the realm imtances.
  // We define it in the same module and do not export it.

  const RealmRecForRealmInstance = new WeakMap();

  function getRealmRecForRealmInstance(realm) {
    if (Object(realm) !== realm) {
      // Detect non-objects.
      throw new TypeError();
    }
    // spec just says throw TypeError
    // todo: but shim should include a message
    if (!RealmRecForRealmInstance.has(realm)) {
      // Realm instance has no realmRec. Should not proceed.
      throw new TypeError();
    }
    return RealmRecForRealmInstance.get(realm);
  }

  function registerRealmRecForRealmInstance(realm, realmRec) {
    if (Object(realm) !== realm) {
      // Detect non-objects.
      throw new TypeError();
    }
    // spec just says throw TypeError
    // todo: but shim should include a message
    if (RealmRecForRealmInstance.has(realm)) {
      // Attempt to change an existing realmRec on a realm instance. Should not proceed.
      throw new TypeError();
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
    const safeEval = createSafeEvaluator(unsafeRec, safeGlobal);
    const safeFunction = createFunctionEvaluator(unsafeRec, safeEval);

    setDefaultBindings(sharedGlobalDescs, safeGlobal, safeEval, safeFunction);

    const realmRec = freeze({
      safeGlobal,
      safeEval,
      safeFunction
    });

    return realmRec;
  }

  // Define newRealm onto new sharedGlobalDescs, so it can be defined in
  // the safeGlobal like the rest of the shared globals.
  function createRealmGlobalObject(unsafeRec) {
    // eslint-disable-next-line no-use-before-define
    const Realm = createRealmFacade(unsafeRec, BaseRealm);
    unsafeRec.sharedGlobalDescs.Realm = {
      value: Realm,
      writable: true,
      configurable: true
    };
    return Realm;
  }

  // TODO: this no longer needs to be a class

  class BaseRealm {
    constructor(options) {
      options = Object(options); // Todo: sanitize

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

        // note: this 'this' comes from the Reflect.construct call in the
        // facade we build above, inside buildChildRealm().

        // todo: what if 'this' is e.g. Window but set to inherit from a Realm?
        // confused deputy / private field question. A: it can't be, we're in a
        // constructor, and constructors can't be invoked directly as
        // functions, using a class protects us here
        unsafeRec = getUnsafeRecForRealm(this.constructor);
      } else if (
        options.intrinsics === undefined &&
        options.isDirectEval === undefined &&
        options.transform === undefined
      ) {
        // In 'undefined' mode, intrinics are not provided, we create a root
        // realm using the fresh set of new intrinics from a new context.

        // The unsafe record is returned with its constructors repaired.
        unsafeRec = createNewUnsafeRec();

        // Define Realm onto new sharedGlobalDescs, so it can be copied onto the
        // safeGlobal like the rest of the .
        const Realm = createRealmGlobalObject(unsafeRec);
        registerUnsafeRecForRealm(Realm, unsafeRec);
      } else {
        // note this would leak the parent TypeError, from which the child can
        // access .prototype and the parent's intrinsics, except that the Realm
        // facade catches all errors and translates them into local Error types
        throw new TypeError('Realm only supports undefined or "inherited" intrinsics.');
      }
      const realmRec = createRealmRec(unsafeRec);
      // todo: is this where we run shims? but only in RootRealms, not compartments

      // note: we never invoke a method on 'this', we only use it as a key in
      // the weakmap. Never say "this." anywhere.
      registerRealmRecForRealmInstance(this, realmRec);
    }
    get global() {
      const { safeGlobal } = getRealmRecForRealmInstance(this);
      return safeGlobal;
    }
    evaluate(x) {
      const { safeEval } = getRealmRecForRealmInstance(this);
      return safeEval(x);
    }
  }

  // Create the current unsafeRec from the current "primal" realm (the realm
  // where the Realm shim is loaded and executed).
  const currentUnsafeRec = createCurrentUnsafeRec();
  const Realm = createRealmFacade(currentUnsafeRec, BaseRealm);
  registerUnsafeRecForRealm(Realm, currentUnsafeRec);

  return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
