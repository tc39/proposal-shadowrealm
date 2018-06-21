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
  ownKeys // Reflect.ownKeys includes Symbols and unenumerables, unlike Object.keys()
} = Reflect;

// See http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
const bind = Function.prototype.bind;
const uncurryThis = bind.bind(bind.call);

export const objectHasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty),
  arrayPush = uncurryThis(Array.prototype.push),
  arrayPop = uncurryThis(Array.prototype.pop),
  arrayJoin = uncurryThis(Array.prototype.join),
  regexpMatch = uncurryThis(RegExp.prototype.match),
  stringIncludes = uncurryThis(String.prototype.includes);
