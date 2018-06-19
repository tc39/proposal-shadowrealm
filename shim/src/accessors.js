// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

import {
  getPrototypeOf,
  defineProperty,
  defineProperties,
  getOwnPropertyDescriptor
} from './commons';

// TOCTTOU and .asString() games could enable attacker to skip some
// intermediate ancestors, so we stringify/propify this once, first.
function asSymbolOrString(s) {
  if (typeof s === 'symbol') {
    return s;
  }
  return `${s}`;
}

/**
 * Replace the legacy accessors of Object to comply with strict mode
 * and ES2016 semantics, we do this by redefining them while in 'use strict'
 * https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__

We need this repair, but woudl it be included when the real realms is integrated into the language.  If not, what are we getting here?

Also note that this changes the primal versions.  

Do we require this for security? Could we provide this in a library of
"utility shims for client code that uses frozen realms"?

On some platforms, the implementation of these functions act as if they are
in sloppy mode: if they're invoked badly, they will expose the global object,
so we need to repair these for security. Thus it is our responsibility to fix
this, and we need to include repairAccessors. E.g. Chrome in 2016.

 */
export function repairAccessors(unsafeRec) {
  const { unsafeGlobal: g } = unsafeRec;

  defineProperties(g.Object.prototype, {
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
      value(unfixedProp) {
        const prop = asSymbolOrString(unfixedProp);
        let base = this;
        let desc;
        while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
          base = getPrototypeOf(base);
        }
        return desc && desc.get;
      }
    },
    __lookupSetter__: {
      value(unfixedProp) {
        const prop = asSymbolOrString(unfixedProp);
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
