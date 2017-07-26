// Declare shorthand functions. Sharing these declarations accross modules
// improves both consitency and minification. Unused declarations are dropped
// by the tree shaking process.

const {
  getPrototypeOf,
  setPrototypeOf,
  defineProperty,
  defineProperties,
  deleteProperty,
  ownKeys
} = Reflect;

const {
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  getOwnPropertyNames,
  create,
  assign,
  freeze
} = Object;

export {
  getPrototypeOf,
  setPrototypeOf,
  defineProperty,
  defineProperties,
  deleteProperty,
  ownKeys,
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  getOwnPropertyNames,
  create,
  assign,
  freeze
};
