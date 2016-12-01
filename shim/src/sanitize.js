// locking down the environment
export function sanitize(sandbox) {
    const { confinedWindow: { Object: o } } = sandbox;
    try {
        // Fixing properties of Object to comply with strict mode
        // and ES2016 semantics, we do this by redefining them while in 'use strict'
        // https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__
        if (o === undefined) {
            return;
        }
        o.defineProperty(o.prototype, '__defineGetter__', {
            value: function (key, fn) {
                return o.defineProperty(this, key, {
                    get: fn
                });
            }
        });
        o.defineProperty(o.prototype, '__defineSetter__', {
            value: function (key, fn) {
                return o.defineProperty(this, key, {
                    set: fn
                });
            }
        });
        o.defineProperty(o.prototype, '__lookupGetter__', {
            value: function (key) {
                var d, p = this;
                while (p && (d = o.getOwnPropertyDescriptor(p, key)) === undefined) {
                    p = o.getPrototypeOf(this);
                }
                return d ? d.get : undefined;
            }
        });
        o.defineProperty(o.prototype, '__lookupSetter__', {
            value: function (key) {
                var d, p = this;
                while (p && (d = o.getOwnPropertyDescriptor(p, key)) === undefined) {
                    p = o.getPrototypeOf(this);
                }
                return d ? d.set : undefined;
            }
        });
        // Immutable Prototype Exotic Objects
        // https://github.com/tc39/ecma262/issues/272
        o.seal(o.prototype);
    } catch (ignore) {
        // Ignored
    }
}