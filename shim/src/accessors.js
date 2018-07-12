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
export function repairAccessors() {
  const {
    defineProperty,
    defineProperties,
    getOwnPropertyDescriptor,
    getPrototypeOf,
    prototype: objectPrototype
  } = Object;

  // On some platforms, the implementation of these functions act as if they are
  // in sloppy mode: if they're invoked badly, they will expose the global object,
  // so we need to repair these for security. Thus it is our responsibility to fix
  // this, and we need to include repairAccessors. E.g. Chrome in 2016.

  try {
    // Verify that the method is not callable.
    // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
    objectPrototype.__lookupGetter__('dummy');
  } catch (ignore) {
    // Throws, no need to patch.
    return;
  }

  function toObject(obj) {
    if (obj === undefined || obj === null) {
      throw new TypeError(`can't convert undefined or null to object`);
    }
    return Object(obj);
  }

  function asPropertyName(obj) {
    if (typeof obj === 'symbol') {
      return obj;
    }
    return `${obj}`;
  }

  function aFunction(obj, accessor) {
    if (typeof obj !== 'function') {
      throw TypeError(`invalid ${accessor} usage`);
    }
    return obj;
  }

  defineProperties(objectPrototype, {
    __defineGetter__: {
      value: function __defineGetter__(prop, func) {
        const O = toObject(this);
        defineProperty(O, prop, {
          get: aFunction(func, 'getter'),
          enumerable: true,
          configurable: true
        });
      }
    },
    __defineSetter__: {
      value: function __defineSetter__(prop, func) {
        const O = toObject(this);
        defineProperty(O, prop, {
          set: aFunction(func, 'setter'),
          enumerable: true,
          configurable: true
        });
      }
    },
    __lookupGetter__: {
      value: function __lookupGetter__(prop) {
        let O = toObject(this);
        prop = asPropertyName(prop);
        let desc;
        while (O && !(desc = getOwnPropertyDescriptor(O, prop))) {
          O = getPrototypeOf(O);
        }
        return desc && desc.get;
      }
    },
    __lookupSetter__: {
      value: function __lookupSetter__(prop) {
        let O = toObject(this);
        prop = asPropertyName(prop);
        let desc;
        while (O && !(desc = getOwnPropertyDescriptor(O, prop))) {
          O = getPrototypeOf(O);
        }
        return desc && desc.set;
      }
    }
  });
}
