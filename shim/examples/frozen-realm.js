const getProto = Object.getPrototypeOf;
const freeze = Object.freeze;
const gopds = Object.getOwnPropertyDescriptors;
const ownKeys = Reflect.ownKeys;

/**
 * To deepFreeze an object is to freeze it and all objects
 * transitively reachable from it via transitive reflective
 * property and prototype traversal.
 */
function deepFreeze(node, frozenSet) {
    // Objects that we're attempting to freeze
    const freezingSet = new Set();

    // If val is something we should be freezing but aren't yet,
    // add it to freezingSet and return true.
    function addFreezing(val) {
        if (Object(val) !== val) {
            // ignore primitives
            return false;
        }
        const t = typeof val;
        if (t !== 'object' && t !== 'function') {
            // future proof: break until someone figures out what it should do
            throw new TypeError('unexpected typeof: ' + t);
        }
        if (frozenSet.has(val) || freezingSet.has(val)) {
            // Ignore if already frozen or freezing
            return false;
        }
        freezingSet.add(val);
        return true;
    }

    function recur(node) {
        if (!addFreezing(node)) { return; }
        if (!freeze(node)) {
            // Yuck. We allowed freeze to indicate failure by returning
            // false rather than throwing, so we need to check for that.
            throw new TypeError('not frozen ' + node);
        }
        recur(getProto(node));
        const descs = gopds(node);
        ownKeys(descs).forEach(key => {
            const desc = descs[key];
            if ('value' in desc) {
                recur(desc.value);
            } else {
                // On an accessor property, deepFreeze does not do a [[Get]]
                // or invoke the getter. Rather, it only recursively freezes
                // the getter and setter themselves.
                recur(desc.get);
                recur(desc.set);
            }
        });
    }

    recur(node);
    // This initial call to recur must be in a state where freezingSet
    // is empty, so a non-erroneous return from recur implies that node
    // and everything in freezingSet is successfully deeply frozen.
    for (let n of freezingSet) {
        frozenSet.add(n);
    }
    return node;
}

class FrozenRealm extends Realm {

    constructor() {
        // intentionally not accepting options for now...
        let isReadyToBeFiltered = false;
        const proxyHandler = {
            get: (target, name) => {
                const value = target[name];
                // only freezing members that are stdlibs to avoid freezing
                // new global properties. this also support polyfilling.
                if (isReadyToBeFiltered && this.stdlib[name] && !frozenSet.has(value)) {
                    deepFreeze(value, frozenSet);
                }
                return value;
            }
        };
        const globalObj = new Proxy({}, proxyHandler);
        // Objects that are deep frozen
        const frozenSet = new WeakSet();
        super({
            globalObj,
        });
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
