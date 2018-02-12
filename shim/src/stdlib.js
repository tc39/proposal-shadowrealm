import { getIntrinsics } from "./intrinsics";

export function getStdLib(sandbox) {
    const intrinsics = getIntrinsics(sandbox);

    return {
        // *** 18.1 Value Properties of the Global Object

        Infinity: { value: Infinity },
        NaN: { value: NaN },
        undefined: { value: undefined },

        // *** 18.2 Function Properties of the Global Object

        eval: { value: intrinsics.eval },
        isFinite: { value: intrinsics.isFinite },
        isNaN: { value: intrinsics.isNaN },
        parseFloat: { value: intrinsics.parseFloat },
        parseInt: { value: intrinsics.parseInt },

        decodeURI: { value: intrinsics.decodeURI },
        decodeURIComponent: { value: intrinsics.decodeURIComponent },
        encodeURI: { value: intrinsics.encodeURI },
        encodeURIComponent: { value: intrinsics.encodeURIComponent },

        // *** 18.3 Constructor Properties of the Global Object

        Array: { value: intrinsics.Array },
        ArrayBuffer: { value: intrinsics.ArrayBuffer },
        Boolean: { value: intrinsics.Boolean },
        DataView: { value: intrinsics.DataView },
        Date: { value: intrinsics.Date },
        Error: { value: intrinsics.Error },
        EvalError: { value: intrinsics.EvalError },
        Float32Array: { value: intrinsics.Float32Array },
        Float64Array: { value: intrinsics.Float64Array },
        Function: { value: intrinsics.Function },
        Int8Array: { value: intrinsics.Int8Array },
        Int16Array: { value: intrinsics.Int16Array },
        Int32Array: { value: intrinsics.Int32Array },
        Map: { value: intrinsics.Map },
        Number: { value: intrinsics.Number },
        Object: { value: intrinsics.Object },
        Promise: { value: intrinsics.Promise },
        Proxy: { value: intrinsics.Proxy },
        RangeError: { value: intrinsics.RangeError },
        ReferenceError: { value: intrinsics.ReferenceError },
        RegExp: { value: intrinsics.RegExp },
        Set: { value: intrinsics.Set },
        // Deprecated
        // SharedArrayBuffer: intrinsics.SharedArrayBuffer,
        String: { value: intrinsics.String },
        Symbol: { value: intrinsics.Symbol },
        SyntaxError: { value: intrinsics.SyntaxError },
        TypeError: { value: intrinsics.TypeError },
        Uint8Array: { value: intrinsics.Uint8Array },
        Uint8ClampedArray: { value: intrinsics.Uint8ClampedArray },
        Uint16Array: { value: intrinsics.Uint16Array },
        Uint32Array: { value: intrinsics.Uint32Array },
        URIError: { value: intrinsics.URIError },
        WeakMap: { value: intrinsics.WeakMap },
        WeakSet: { value: intrinsics.WeakSet },

        // *** 18.4 Other Properties of the Global Object

        Atomics: { value: intrinsics.Atomics },
        JSON: { value: intrinsics.JSON },
        Math: { value: intrinsics.Math },
        Reflect: { value: intrinsics.Reflect },

        // *** Annex B

        escape: { value: intrinsics.escape },
        unescape: { value: intrinsics.unescape }
    };
}
