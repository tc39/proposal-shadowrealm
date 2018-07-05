// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

/**
 * Replace the legacy accessors of Object to comply with strict mode
 * and ES2016 semantics, we do this by redefining them while in 'use strict'
 * https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__

We need this repair, but would it be included when the real realms is
integrated into the language. If not, what are we getting here?

Also note that this changes the primal versions.

On some platforms, the implementation of these functions act as if they are
in sloppy mode: if they're invoked badly, they will expose the global object,
so we need to repair these for security. Thus it is our responsibility to fix
this, and we need to include repairAccessors. E.g. Chrome in 2016.

todo: It would be better to detect and only repair the functions that have
the bug.
 */

// todo: this file should be moved out to a separate repo and npm module

// We use this function in two ways. We use it directly to fix the primal
// realm's Object.prototype, and we convert it into a string to be executed
// inside each new RootRealm to fix their Object.prototypes too. So don't
// import anything from the outside.

// todo: This function is serialized and evaluated outside of the primal
// realms and it currently can't contain code coverage metrics.
/* istanbul ignore file */
export function repairAccessors() {
  const { getPrototypeOf, defineProperties, defineProperty, getOwnPropertyDescriptor } = Object;

  // TOCTTOU and .asString() games could enable attacker to skip some
  // intermediate ancestors, so we stringify/propify this once, first.
  function asPropertyName(prop) {
    if (typeof prop === 'symbol') {
      return prop;
    }
    return `${prop}`;
  }

  defineProperties(Object.prototype, {
    __defineGetter__: {
      value(prop, func) {
        return defineProperty(this, prop, {
          get: func,
          enumerable: true,
          configurable: true
        });
      }
    },
    __defineSetter__: {
      value(prop, func) {
        return defineProperty(this, prop, {
          set: func,
          enumerable: true,
          configurable: true
        });
      }
    },
    __lookupGetter__: {
      value(prop) {
        prop = asPropertyName(prop); // sanitize property name/symbol
        let base = this;
        let desc;
        while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
          base = getPrototypeOf(base);
        }
        return desc && desc.get;
      }
    },
    __lookupSetter__: {
      value(prop) {
        prop = asPropertyName(prop); // sanitize property name/symbol
        let base = this;
        let desc;
        while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
          base = getPrototypeOf(base);
        }
        return desc && desc.set;
      }
    }
  });
}

export const repairAccessorsShim = `(${repairAccessors})();`;
