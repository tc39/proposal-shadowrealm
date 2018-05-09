// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

import {
  getPrototypeOf,
  defineProperty,
  defineProperties,
  getOwnPropertyDescriptor
} from './commons';

/**
 * Replace the legacy accessors of Object to comply with strict mode
 * and ES2016 semantics, we do this by redefining them while in 'use strict'
 * https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__
 */
export function repairAccessors(sandbox) {
  const { unsafeGlobal: g } = sandbox;

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
      value(prop) {
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
