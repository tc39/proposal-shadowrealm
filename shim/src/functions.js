// Adapted from SES/Caja
// Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

import { defineProperty, defineProperties, getPrototypeOf, setPrototypeOf } from './commons';

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

  setPrototypeOf(TamedFunction, unsafeFunction.prototype.constructor);
}

/**
 * This block replaces the original Function constructor, and the original
 * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
 * safe replacements that preserve SES confinement. After this block is done,
 * the originals should no longer be reachable.
 */
export function repairFunctions(sandbox) {
  const { unsafeGlobal: g } = sandbox;
  const hasAsyncIteration = typeof g.Symbol.asyncIterator !== 'undefined';

  // Here, the order of operation is important: Function needs to be
  // repaired first since the other constructors need it.
  repairFunction(sandbox, 'Function', 'function');
  repairFunction(sandbox, 'GeneratorFunction', 'function*');
  repairFunction(sandbox, 'AsyncFunction', 'async function');
  if (hasAsyncIteration) {
    repairFunction(sandbox, 'AsyncGeneratorFunction', 'async function*');
  }
}
