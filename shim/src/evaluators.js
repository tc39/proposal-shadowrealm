// Portions adapted from V8 - Copyright 2016 the V8 project authors.
// https://github.com/v8/v8/blob/master/src/builtins/builtins-function.cc

import {
  apply,
  arrayJoin,
  arrayPop,
  arrayPush,
  create,
  defineProperty,
  getOwnPropertyDescriptors,
  getOwnPropertyNames,
  getPrototypeOf,
  regexpMatch,
  setPrototypeOf,
  stringIncludes
} from './commons';
import { ScopeHandler } from './scopeHandler';
import { assert, throwTantrum } from './utilities';

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

export function createSafeEvaluator(unsafeRec, safeGlobal) {
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
export function createFunctionEvaluator(unsafeRec, safeEval) {
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
