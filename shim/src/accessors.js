// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

/**
 * Replace the legacy accessors of Object to comply with strict mode
 * and ES2016 semantics, we do this by redefining them while in 'use strict'.
 *
 * todo: list the issues resolved
 *
 * This function can be used in two ways: (1) invoked directly to fix the primal
 * realm's Object.prototype, and (2) converted to a string to be executed
 * inside each new RootRealm to fix their Object.prototypes. Evaluation requires
 * the function to have no dependencies, so don't import anything from the outside.
 */

// todo: this file should be moved out to a separate repo and npm module.

// todo: This function is stringified and evaluated outside of the primal
// realms and it currently can't contain code coverage metrics.
/* istanbul ignore file */
export function repairAccessors() {
  const {
    getPrototypeOf,
    defineProperty,
    getOwnPropertyDescriptor,
    prototype: objectPrototype
  } = Object;

  // On some platforms, the implementation of these functions act as if they are
  // in sloppy mode: if they're invoked badly, they will expose the global object,
  // so we need to repair these for security. Thus it is our responsibility to fix
  // this, and we need to include repairAccessors. E.g. Chrome in 2016.

  // todo: this shim should only be applied if the security bug is present.

  function makeDefineAccessor(method, accessor) {
    defineProperty(objectPrototype, method, {
      value(prop, func) {
        const result = defineProperty(this, prop, {
          [accessor]: func,
          enumerable: true,
          configurable: true
        });
        // Note that we cannot assume that defineProperty reports failure by throwing.
        // To fix an obscure problem (link needed), defineProperty is now allowed to
        // report failure by returning false as well.
        if (result === false) {
          throw new TypeError(`Cannot redefine property: ${[prop]}`);
        }
      }
    });
  }

  makeDefineAccessor('__defineGetter__', 'get');
  makeDefineAccessor('__defineSetter__', 'set');

  // TOCTTOU and .asString() games could enable attacker to skip some
  // intermediate ancestors, so we stringify/propify this once, first.
  function asPropertyName(prop) {
    if (typeof prop === 'symbol') {
      return prop;
    }
    return `${prop}`;
  }

  function makeLookupAccessor(method, accessor) {
    defineProperty(objectPrototype, method, {
      value(prop) {
        prop = asPropertyName(prop); // sanitize property name/symbol
        let base = this;
        let desc;
        while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
          base = getPrototypeOf(base);
        }
        return desc && desc[accessor];
      }
    });
  }

  makeLookupAccessor('__lookupGetter__', 'get');
  makeLookupAccessor('__lookupSetter__', 'set');
}

export const repairAccessorsShim = `(${repairAccessors})();`;
