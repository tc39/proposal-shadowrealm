// Portions adapted from V8 - Copyright 2016 the V8 project authors.
// https://github.com/v8/v8/blob/master/src/builtins/builtins-function.cc

import { defineProperty, setPrototypeOf } from './commons';
import { Handler } from './handler';

function buildOptimizer(constants) {
  if (!Array.isArray(constants)) {
    return '';
  }
  if (constants.contains('eval')) throw new Error();

  return `const {${constants.join(',')}} = arguments[0];`;
}

export function createScopedEvaluatorFactory(unsafeRec, constants) {
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

export function createSafeEvaluator(unsafeRec, globalObject) {
  const { unsafeGlobal, unsafeFunction } = unsafeRec;

  // This proxy has several functions:
  // 1. works with the sentinel to alternate between direct eval and confined eval.
  // 2. shadows all properties of the hidden global by declaring them as undefined.
  // 3. resolves all existing properties of the sandboxed global.
  const handler = new Handler(unsafeRec);
  const proxy = new Proxy(globalObject, handler);

  const scopedEvaluatorFactory = createScopedEvaluatorFactory(unsafeRec);
  const scopedEvaluator = scopedEvaluatorFactory(proxy);

  // We use the the concise method syntax to create an eval without a
  // [[Construct]] behavior (such that the invocation "new eval()" throws
  // TypeError: eval is not a constructor"), but which still accepts a 'this'
  // binding.
  const safeEval = {
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
  setPrototypeOf(safeEval, unsafeFunction.prototype);

  defineProperty(safeEval, unsafeGlobal.Symbol.toStringTag, {
    value: 'function eval() { [shim code] }',
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

    return safeEval(src);
  };

  // Ensure that Function from any compartment in a root realm can be used
  // with instance checks in any compartment of the same root realm.
  setPrototypeOf(safeFunction, unsafeFunction.prototype);

  // Ensure that any function created in any compartment in a root realm is an
  // instance of Function in any compartment of the same root ralm.
  defineProperty(safeFunction, 'prototype', { value: unsafeFunction.prototype });

  // Provide a custom output without overwriting the Function.prototype.toString
  // which is called by some libraries.
  defineProperty(safeFunction, unsafeGlobal.Symbol.toStringTag, {
    value: 'function Function() { [shim code] }',
    writable: false,
    enumerable: false,
    configurable: true
  });

  return safeFunction;
}
