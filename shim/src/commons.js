// Declare shorthand functions. Sharing these declarations across modules
// improves both consistency and minification. Unused declarations are
// dropped by the tree shaking process.

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

export const {
  apply,
  ownKeys // this includes Symbols and unenumerables, unlike Object.keys()
} = Reflect;

export const objectHasOwnProperty = Object.prototype.hasOwnProperty;
