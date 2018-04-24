// Adapted from SES/Caja
// Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

import { defineProperty, defineProperties, getPrototypeOf, setPrototypeOf } from '../utils/commons';

/**
 * The process to repair constructors:
 * 1. Obtain the prototype from an instance
 * 2. Create a substitute noop constructor
 * 3. Replace its prototype property with the original prototype
 * 4. Replace its prototype property's constructor with itself
 * 5. Replace its [[Prototype]] slot with the noop constructor of Function
 */
function repairFunction(realmRec, functionName, functionDecl) {
  const { unsafeGlobal, unsafeEval, unsafeFunction } = realmRec;

  const FunctionInstance = unsafeEval(`(${functionDecl}(){})`);
  const FunctionPrototype = getPrototypeOf(FunctionInstance);

  const RealmFunction = unsafeFunction('return function(){}');

  defineProperties(RealmFunction, {
    name: {
      value: functionName
    },
    prototype: {
      value: FunctionPrototype
    }
  });
  defineProperty(FunctionPrototype, 'constructor', { value: RealmFunction });

  // Prevent loop in case of Function.
  if (RealmFunction !== unsafeGlobal.Function.prototype.constructor) {
    setPrototypeOf(RealmFunction, unsafeGlobal.Function.prototype.constructor);
  }
}

/**
 * This block replaces the original Function constructor, and the original
 * %GeneratorFunction% %AsyncFunction% and %AsyncGeneratorFunction%, with
 * safe replacements that preserve SES confinement. After this block is done,
 * the originals should no longer be reachable.
 */
export function repairFunctions(realmRec) {
  const { unsafeGlobal } = realmRec;
  const hasAsyncIteration = typeof unsafeGlobal.Symbol.asyncIterator !== 'undefined';

  // Here, the order of operation is important: Function needs to be
  // repaired first since the other constructors need it.
  repairFunction(realmRec, 'Function', 'function');
  repairFunction(realmRec, 'GeneratorFunction', 'function*');
  repairFunction(realmRec, 'AsyncFunction', 'async function');
  if (hasAsyncIteration) {
    repairFunction(realmRec, 'AsyncGeneratorFunction', 'async function*');
  }
}
