// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

import { getPrototypeOf, defineProperty, getOwnPropertyDescriptor } from './commons';

// Fix legacy accessors to comply with strict mode and ES2016 semantics,
// we need to redefine them while in strict mode.
// https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__

export function repairAccessors(objProto) {

    try {

        defineProperty(objProto, '__defineGetter__', {
            value: function (prop, func) {
                return defineProperty(this, prop, {
                    get: func,
                    enumerable: true,
                    configurable: true
                });
            }
        });

        defineProperty(objProto, '__defineSetter__', {
            value: function (prop, func) {
                return defineProperty(this, prop, {
                    set: func,
                    enumerable: true,
                    configurable: true
                });
            }
        });

        defineProperty(objProto, '__lookupGetter__', {
            value: function (prop) {
                let base = this;
                let desc;
                while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
                    base = getPrototypeOf(base);
                }
                return desc && desc.get;
            }
        });

        defineProperty(objProto, '__lookupSetter__', {
            value: function (prop) {
                let base = this;
                let desc;
                while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
                    base = getPrototypeOf(base);
                }
                return desc && desc.set;
            }
        });

    } catch (ignore) {
        // Ignored
    }
}