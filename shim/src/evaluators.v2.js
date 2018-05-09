import { defineProperties } from '../utils/commons';
import { stdlib } from './stdlib';
import { deepFreeze } from './ses-deep-freeze';

let evalEvaluatorFactory;

// Remove when SecureWindow is refactored to use sandbox
let unfrozenSet;
export function setUnfrozenSet(names) {
  unfrozenSet = new Set(names);
}

/**
 * This ecaluator declares commonly used references like
 * "window" and the JS standard lib as constants to allow
 * the JIT optimizer to link to static references.
 */
function createEvalEvaluatorFactory(sandbox) {
  const {
    realmRec: { unsafeFunction }
  } = sandbox;

  // Function and eval are not in our standard lib. Only Function
  // is added here since eval needs to context switch and can't be
  // a constant.
  return unsafeFunction(`
    with (arguments[0]) {
      const {${stdlib.join(',')}, Function, window, document} = arguments[0];
      return function() {
        'use strict';
        return eval(arguments[0]);
      };
    }
  `);
}

class FreezingHandler {
  constructor(sandbox) {
    const {
      realmRec: { unsafeGlobal }
    } = sandbox;
    this.unsafeGlobal = unsafeGlobal;
  }
  setInternalEval() {
    // This sentinel allows one scoped direct eval.
    this.isInternalEval = true;
  }
  clearInternalEval() {
    // Return to safe eval.
    this.isInternalEval = false;
  }
  get(target, prop) {
    // Special treatment for eval.
    if (prop === 'eval') {
      if (this.isInternalEval) {
        this.isInternalEval = false;
        return this.unsafeGlobal.eval;
      }
      return target.eval;
    }
    // Properties of global.
    if (prop in target) {
      const value = target[prop];
      if (unfrozenSet && unfrozenSet.has(prop)) {
        deepFreeze(value);
        unfrozenSet.delete(prop);
      }
      return value;
    }
    // Prevent a lookup for other properties.
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

export function createEvalEvaluator(sandbox) {
  const { globalObject } = sandbox;

  // This proxy has several functions:
  // 1. works with the sentinel to alternate between direct eval and confined eval.
  // 2. shadows all properties of the hidden global by declaring them as undefined.
  // 3. resolves all existing properties of the secure global.
  const handler = new FreezingHandler(sandbox);
  const proxy = new Proxy(globalObject, handler);

  // Lazy define and use the factory.
  if (!evalEvaluatorFactory) {
    evalEvaluatorFactory = createEvalEvaluatorFactory(sandbox);
  }
  const scopedEvaluator = evalEvaluatorFactory(proxy);

  function evaluator(src) {
    handler.setInternalEval();
    // Ensure that "this" resolves to the secure global.
    const result = scopedEvaluator.call(globalObject, src);
    handler.clearInternalEval();
    return result;
  }

  // Mimic the native eval() function. New properties are
  // by default non-writable and non-configurable.
  defineProperties(evaluator, {
    name: {
      value: 'eval'
    }
  });

  // This instance is namespace-specific, and therefore doesn't
  // need to be frozen (only the objects reachable from it).
  return evaluator;
}

/**
 * A safe version of the native Function which relies on
 * the safety of evalEvaluator for confinement.
 */
export function createFunctionEvaluator(sandbox) {
  const {
    realmRec: { unsafeFunction }
  } = sandbox;

  const evaluator = function(...params) {
    const functionBody = params.pop() || '';
    // Conditionaly appends a new line to prevent execution during
    // construction.
    const functionParams = params.join(',') + (params.length > 0 ? '\n' : '');
    const src = `(function(${functionParams}){\n${functionBody}\n})`;
    // evalEvaluator is created after FunctionEvaluator,
    // so we can't link directly to it.
    return sandbox.evalEvaluator(src);
  };

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
  return evaluator;
}
