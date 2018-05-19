// Portions adapted from V8 - Copyright 2016 the V8 project authors.
// https://github.com/v8/v8/blob/master/src/builtins/builtins-function.cc

import { GlobalObject, Intrinsics, ShimSandbox } from './symbols';
import { defineProperties } from './commons';
import { Handler } from './handler';

export function getDirectEvalEvaluatorFactory(sandbox) {
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

export function getDirectEvalEvaluator(realmRec) {
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

  // Ensure that the different eval instances of the different
  // realms all answer properly when used with the instanceof
  // operator to preserve indentity.
  const FunctionPrototype = sandbox.unsafeFunction.prototype;

  // Mimic the native eval() function. New properties are
  // by default non-writable and non-configurable.
  defineProperties(evaluator, {
    name: {
      value: 'eval'
    },
    prototype: {
      value: FunctionPrototype
    }
  });

  // This instance is realm-specific, and therefore doesn't
  // need to be frozen (only the objects reachable from it).

  // Once created for a realm, the reference must be updated everywhere.
  return evaluator;
}

/**
 * A safe version of the native Function which relies on
 * the safety of evalEvaluator for confinement.
 */
export function getFunctionEvaluator(realmRec) {
  const sandbox = realmRec[ShimSandbox];
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
  // realms all answer properly when used with the instanceof
  // operator to preserve indentity.
  const FunctionPrototype = sandbox.unsafeFunction.prototype;

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
  return evaluator;
}
