export function getStdLib(intrinsics) {
  const i = intrinsics;

  return {
    // *** 18.1 Value Properties of the Global Object

    Infinity: { value: Infinity },
    NaN: { value: NaN },
    undefined: { value: undefined },

    // *** 18.2 Function Properties of the Global Object

    // Make eval wrtitable to allow proxy to return a different
    // value, and leave it non-unconfigurable to prevent userland
    // from changing its descriptor and breaking an invariant.
    eval: { value: i.eval, writable: true },
    isFinite: { value: i.isFinite },
    isNaN: { value: i.isNaN },
    parseFloat: { value: i.parseFloat },
    parseInt: { value: i.parseInt },

    decodeURI: { value: i.decodeURI },
    decodeURIComponent: { value: i.decodeURIComponent },
    encodeURI: { value: i.encodeURI },
    encodeURIComponent: { value: i.encodeURIComponent },

    // *** 18.3 Constructor Properties of the Global Object

    Array: { value: i.Array },
    ArrayBuffer: { value: i.ArrayBuffer },
    Boolean: { value: i.Boolean },
    DataView: { value: i.DataView },
    Date: { value: i.Date },
    Error: { value: i.Error },
    EvalError: { value: i.EvalError },
    Float32Array: { value: i.Float32Array },
    Float64Array: { value: i.Float64Array },
    Function: { value: i.Function },
    Int8Array: { value: i.Int8Array },
    Int16Array: { value: i.Int16Array },
    Int32Array: { value: i.Int32Array },
    Map: { value: i.Map },
    Number: { value: i.Number },
    Object: { value: i.Object },
    Promise: { value: i.Promise },
    Proxy: { value: i.Proxy },
    RangeError: { value: i.RangeError },
    ReferenceError: { value: i.ReferenceError },
    RegExp: { value: i.RegExp },
    Set: { value: i.Set },
    // SharedArrayBuffer - Deprecated on Jan 5, 2018
    String: { value: i.String },
    Symbol: { value: i.Symbol },
    SyntaxError: { value: i.SyntaxError },
    TypeError: { value: i.TypeError },
    Uint8Array: { value: i.Uint8Array },
    Uint8ClampedArray: { value: i.Uint8ClampedArray },
    Uint16Array: { value: i.Uint16Array },
    Uint32Array: { value: i.Uint32Array },
    URIError: { value: i.URIError },
    WeakMap: { value: i.WeakMap },
    WeakSet: { value: i.WeakSet },

    // *** 18.4 Other Properties of the Global Object

    Atomics: { value: i.Atomics },
    JSON: { value: i.JSON },
    Math: { value: i.Math },
    Reflect: { value: i.Reflect },

    // *** Annex B

    escape: { value: i.escape },
    unescape: { value: i.unescape },

    // *** ECMA-402

    Intl: { value: i.Intl },

    // *** ESNext

    Realm: { value: i.Realm }
  };
}
