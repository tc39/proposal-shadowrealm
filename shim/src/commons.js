// Declare shorthand functions. Sharing these declarations across modules
// improves both consistency and minification. Unused declarations are
// dropped by the tree shaking process.

// we capture these, not just for brevity, but for security. If any code
// modifies Object to change what 'assign' points to, the Realm shim would be
// corrupted.

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
// which only lives at http://web.archive.org/web/20160805225710/http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
// (the native call is about 10x faster on FF than chrome)
// this version of uncurryThis is about 100x slower on FF, equal on chrome, 2x slower on Safari
// const bind = Function.prototype.bind;
// const uncurryThis = bind.bind(bind.call);

// this version is about 10x slower on FF, equal on chrome, 2x slower on Safari
const uncurryThis = fn => (thisArg, ...args) => apply(fn, thisArg, args);

// We also capture these for security: changes to Array.prototype after the
// Realm shim runs shouldn't affect subsequent Realm operations.
export const objectHasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty),
  arrayForEach = uncurryThis(Array.prototype.forEach),
  arrayFilter = uncurryThis(Array.prototype.filter),
  arrayPush = uncurryThis(Array.prototype.push),
  arrayPop = uncurryThis(Array.prototype.pop),
  arrayJoin = uncurryThis(Array.prototype.join),
  arrayConcat = uncurryThis(Array.prototype.concat),
  regexpMatch = uncurryThis(RegExp.prototype.match),
  stringIncludes = uncurryThis(String.prototype.includes);
