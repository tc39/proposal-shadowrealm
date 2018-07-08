// Adapted from SES/Caja
// Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

import { defineProperty, defineProperties, getPrototypeOf, setPrototypeOf } from './commons';

/**
 * The process to repair constructors:
 * 1. Obtain the prototype from an instance of the syntax
 * 2. Create a substitute noop constructor
 * 3. Replace its prototype property with the original prototype
 * 4. Replace its prototype property's constructor with itself
 * 5. Replace its [[Prototype]] slot with the noop constructor of Function
 */

// todo: This function is stringified and evaluated outside of the primal
// realms and it currently can't contain code coverage metrics.
/* istanbul ignore file */
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
export function repairFunctions(unsafeRec) {
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
