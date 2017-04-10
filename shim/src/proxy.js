let internalFlag = false;

export function setInternalEvaluation() {
    internalFlag = true;
}

export function resetInternalEvaluation() {
    internalFlag = false;
}

export function isInternalEvaluation() {
    return internalFlag === true;
}

export const proxyHandler = {
    get(sandbox, propName) {
        if (propName === 'eval' && internalFlag) {
            resetInternalEvaluation();
            return sandbox.confinedWindow.eval;
        }
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
        if (propName === 'eval' && internalFlag) {
            return true;
        }
        if (propName in sandbox.globalObject) {
            return true;
        } else if (propName in sandbox.confinedWindow) {
            throw new ReferenceError(`${propName} is not defined. If you are using typeof ${propName}, you can change your program to use typeof global.${propName} instead`);
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