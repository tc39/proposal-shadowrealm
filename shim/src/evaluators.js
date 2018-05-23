// Portions adapted from V8 - Copyright 2016 the V8 project authors.
// https://github.com/v8/v8/blob/master/src/builtins/builtins-function.cc

import { GlobalObject, Intrinsics, ShimSandbox } from './symbols';
import { defineProperty, getOwnPropertyDescriptor, setPrototypeOf } from './commons';
import { Handler } from './handler';

function buildOptimizer(constants) {
  if (!Array.isArray(constants)) {
    return '';
  }

  if (constants.contains('eval')) {
    throw new TypeError();
  }

  return `const {${constants.join(',')}} = arguments[0];`;
}

export function getDirectEvalEvaluatorFactory(sandbox, constants) {
  const { unsafeFunction } = sandbox;

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

export function getDirectEvalEvaluator(realmRec) {
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

  evaluator.toString = () => 'function eval() { [shim code] }';
  return evaluator;
}

/**
 * A safe version of the native Function which relies on
 * the safety of evalEvaluator for confinement.
 */
export function getFunctionEvaluator(realmRec) {
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

  evaluator.toString = () => 'function Function() { [shim code] }';
  return evaluator;
}
