import {
  defineProperty,
  deleteProperty,
  getOwnPropertyDescriptor,
  getOwnPropertyNames
} from './commons';

// this flag allow us to determine if the eval() call is a controlled eval done by the realm's code
// or if it is user-land invocation, so we can react differently.
let isInternalEvaluation = false;

export function setInternalEvaluation() {
  isInternalEvaluation = true;
}

export function resetInternalEvaluation() {
  isInternalEvaluation = false;
}

export const proxyHandler = {
  get(sandbox, propName) {
    if (propName === 'eval' && isInternalEvaluation) {
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
    defineProperty(sandbox.globalObject, propName, descriptor);
    return true;
  },
  deleteProperty(sandbox, propName) {
    return deleteProperty(sandbox.globalObject, propName);
  },
  has(sandbox, propName) {
    if (propName === 'eval' && isInternalEvaluation) {
      return true;
    }
    if (propName in sandbox.globalObject) {
      return true;
    } else if (propName in sandbox.confinedWindow) {
      throw new ReferenceError(
        `${propName} is not defined. If you are using typeof ${propName}, you can change your program to use typeof global.${propName} instead`
      );
    }
    return false;
  },
  ownKeys(sandbox) {
    return getOwnPropertyNames(sandbox.globalObject);
  },
  getOwnPropertyDescriptor(sandbox, propName) {
    return getOwnPropertyDescriptor(sandbox.globalObject, propName);
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
  }
};
