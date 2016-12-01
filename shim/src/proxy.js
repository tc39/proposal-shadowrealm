export const proxyHandler = {
    get(sandbox, propName) {
        return sandbox.globalObject[propName];
    },
    set(sandbox, propName, newValue) {
        sandbox.globalObject[propName] = newValue;
        return true;
    },
    defineProperty(sandbox, propName, descriptor) {
        Object.defineProperty(sandbox.globalObject, propName, descriptor);
        return true;
    },
    deleteProperty(sandbox, propName) {
        return Reflect.deleteProperty(sandbox.globalObject, propName);
    },
    has(sandbox, propName) {
        if (propName in sandbox.globalObject) {
            return true;
        } else if (propName in sandbox.confinedWindow) {
            throw new ReferenceError(`${propName} is not defined. Change your program to use this.${propName} instead`);
        }
        return false;
    },
    ownKeys(sandbox) {
        return Object.getOwnPropertyNames(sandbox.globalObject);
    },
    getOwnPropertyDescriptor(sandbox, propName) {
        return Object.getOwnPropertyDescriptor(sandbox.globalObject, propName);
    },
    isExtensible(sandbox) {
        // TODO: can it becomes non-extensible?
        return true;
    },
    getPrototypeOf(sandbox) {
        return null;
    },
    setPrototypeOf(sandbox, prototype) {
        return prototype === null ? true : false;
    },
};