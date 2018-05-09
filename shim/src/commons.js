// Declare shorthand functions. Sharing these declarations accross modules
// improves both consitency and minification. Unused declarations are dropped
// by the tree shaking process.

export const {
  assign,
  create,
  defineProperties,
  freeze,
  getOwnPropertyDescriptors,
  getOwnPropertyNames
} = Object;

export const {
  apply,
  defineProperty,
  deleteProperty,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  ownKeys,
  setPrototypeOf
} = Reflect;

export const objectHasOwnProperty = Object.prototype.hasOwnProperty;
