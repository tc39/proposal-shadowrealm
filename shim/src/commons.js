// Declare shorthand functions. Sharing these declarations accross modules
// improves both consitency and minification. Unused declarations are dropped
// by the tree shaking process.

export const {
  assign,
  create,
  defineProperties,
  defineProperty,
  freeze,
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  getOwnPropertyNames,
  getPrototypeOf,
  setPrototypeOf
} = Object;

// TODO: if we use Reflect.* and it returns false, we should either inspect
// the failure, or use Object.* instead.

export const {
  apply,
  deleteProperty,
  ownKeys // similar but different than Object.ownKeys
} = Reflect;

export const objectHasOwnProperty = Object.prototype.hasOwnProperty;
