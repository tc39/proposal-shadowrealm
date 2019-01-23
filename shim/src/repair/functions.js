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

// todo: this file should be moved out to a separate repo and npm module.
export function repairFunctions() {
  const { defineProperties, getPrototypeOf, setPrototypeOf } = Object;

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
      // eslint-disable-next-line no-new-func
      FunctionInstance = (0, eval)(declaration);
    } catch (e) {
      if (e instanceof SyntaxError) {
        // Prevent failure on platforms where async and/or generators are not supported.
        return;
      }
      // Re-throw
      throw e;
    }
    const FunctionPrototype = getPrototypeOf(FunctionInstance);

    // Prevents the evaluation of source when calling constructor on the
    // prototype of functions.
    const TamedFunction = function() {
      throw new TypeError('Not available');
    };
    defineProperties(TamedFunction, { name: { value: name } });

    // (new Error()).constructors does not inherit from Function, because Error
    // was defined before ES6 classes. So we don't need to repair it too.

    // (Error()).constructor inherit from Function, which gets a tamed constructor here.

    // todo: in an ES6 class that does not inherit from anything, what does its
    // constructor inherit from? We worry that it inherits from Function, in
    // which case instances could give access to unsafeFunction. markm says
    // we're fine: the constructor inherits from Object.prototype

    // This line replaces the original constructor in the prototype chain
    // with the tamed one. No copy of the original is peserved.
    defineProperties(FunctionPrototype, { constructor: { value: TamedFunction } });

    // This line sets the tamed constructor's prototype data property to
    // the original one.
    defineProperties(TamedFunction, { prototype: { value: FunctionPrototype } });

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

  // "plain arrow functions" inherit from Function.prototype

  repairFunction('Function', '(function(){})');
  repairFunction('GeneratorFunction', '(function*(){})');
  repairFunction('AsyncFunction', '(async function(){})');
  repairFunction('AsyncGeneratorFunction', '(async function*(){})');
}
