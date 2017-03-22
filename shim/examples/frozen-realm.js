// dummy deep freeze implementation with memoizable accessor.
function deepFreeze(o, frozenSet) {
    Object.freeze(o);
    frozenSet.add(o);
    for (let name in o) {
        const value = o[name];
        const type = typeof value;
        if (value && (type === 'function ' || type === 'object') && !frozenSet.has(value)) {
            deepFreeze(value, frozenSet);
        }
    }
    if (o.prototype) {
        deepFreeze(o.prototype, frozenSet)
    }
}

class FrozenRealm extends Realm {

    constructor() {
        let isReadyToBeFiltered = false;
        const proxyHandler = {
            get: (target, name) => {
                const value = target[name];
                // only freezing members that are stdlibs to avoid freezing
                // new global properties. this also support polyfilling.
                if (isReadyToBeFiltered && this.stdlibs[name] && !this.frozenSet.has(value)) {
                    deepFreeze(value, this.frozenSet);
                }
                return value;
            }
        };
        const global = {};
        const frozenSet = new WeakSet();
        super(global, proxyHandler);
        // polyfill your globals
        this.eval(`Array.prototype.foo = function () {}`);
        // freezing intrinsics that can be accesed via grammar, e.g. [].prototype.slice = function () { ... }
        const { Array, Object, Function } = this.intrinsics;
        deepFreeze(Function, frozenSet);
        deepFreeze(Object, frozenSet);
        deepFreeze(Array, frozenSet);
        isReadyToBeFiltered = true;
    }

}

const fr = new FrozenRealm();
fr.eval(`[].__proto__.slice = function () {}`); // throws
fr.eval(`Array.prototype.foo`);                 // yields a function
fr.eval(`Map.prototype.set = function () {}`);  // throws