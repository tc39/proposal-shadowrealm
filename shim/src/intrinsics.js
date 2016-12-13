import Realm from "./realm.js";

const getProto = Object.getPrototypeOf;
const iteratorSymbol = (typeof Symbol && Symbol.iterator) || "@@iterator";

export function getIntrinsics(sandbox) {
    const { confinedWindow: _, globalObject } = sandbox;
    const anonymousArrayIteratorPrototype = getProto(_.Array(0)[iteratorSymbol]());
    const anonymousStringIteratorPrototype = getProto(_.String()[iteratorSymbol]());
    const anonymousIteratorPrototype = getProto(anonymousArrayIteratorPrototype);

    const strictArgumentsGenerator = _.eval('(function*(){"use strict";yield arguments;})');
    const anonymousGenerator = getProto(strictArgumentsGenerator);
    const anonymousGeneratorPrototype = getProto(anonymousGenerator);
    const anonymousGeneratorFunction = anonymousGeneratorPrototype.constructor;

    return {
        // %Array%
        "Array": _.Array,
        // %ArrayBuffer%
        "ArrayBuffer": _.ArrayBuffer,
        // %ArrayBufferPrototype%
        "ArrayBufferPrototype": _.ArrayBuffer.prototype,
        // %ArrayIteratorPrototype%
        "ArrayIteratorPrototype": anonymousArrayIteratorPrototype,
        // %ArrayPrototype%
        "ArrayPrototype": _.Array.prototype,
        // %ArrayProto_values%
        "ArrayProto_values": _.Array.prototype.values,
        // %Boolean%
        "Boolean": _.Boolean,
        // %BooleanPrototype%
        "BooleanPrototype": _.Boolean.prototype,
        // %DataView%
        "DataView": _.DataView,
        // %DataViewPrototype%
        "DataViewPrototype": _.DataView.prototype,
        // %Date%
        "Date": _.Date,
        // %DatePrototype%
        "DatePrototype": _.Date.prototype,
        // %decodeURI%
        "decodeURI": _.decodeURI,
        // %decodeURIComponent%
        "decodeURIComponent": _.decodeURIComponent,
        // %encodeURI%
        "encodeURI": _.encodeURI,
        // %encodeURIComponent%
        "encodeURIComponent": _.encodeURIComponent,
        // %Error%
        "Error": _.Error,
        // %ErrorPrototype%
        "ErrorPrototype": _.Error.prototype,
        // %eval%
        "eval": sandbox.eval,
        // %EvalError%
        "EvalError": _.EvalError,
        // %EvalErrorPrototype% 
        "EvalErrorPrototype": _.EvalError.prototype,
        // %Float32Array%
        "Float32Array": _.Float32Array,
        // %Float32ArrayPrototype%
        "Float32ArrayPrototype": _.Float32Array.prototype,
        // %Float64Array%
        "Float64Array": _.Float64Array,
        // %Float64ArrayPrototype%
        "Float64ArrayPrototype": _.Float64Array.prototype,
        // %Function%
        "Function": sandbox.Function,
        // %FunctionPrototype%
        "FunctionPrototype": _.Function.prototype,
        // %Generator%
        "Generator": anonymousGenerator,
        // %GeneratorFunction%
        "GeneratorFunction": anonymousGeneratorFunction,
        // %GeneratorPrototype%
        "GeneratorPrototype": anonymousGeneratorPrototype,
        // %Int8Array%
        "Int8Array": _.Int8Array,
        // %Int8ArrayPrototype%
        "Int8ArrayPrototype": _.Int8Array.prototype,
        // %Int16Array%
        "Int16Array": _.Int16Array,
        // %Int16ArrayPrototype%,
        "Int16ArrayPrototype": _.Int16Array.prototype,
        // %Int32Array%
        "Int32Array": _.Int32Array,
        // %Int32ArrayPrototype%
        "Int32ArrayPrototype": _.Int32Array.prototype,
        // %isFinite%
        "isFinite": _.isFinite,
        // %isNaN%
        "isNaN": _.isNaN,
        // %IteratorPrototype%
        "IteratorPrototype": anonymousIteratorPrototype,
        // %JSON%
        "JSON": _.JSON,
        // %Map%
        "Map": _.Map,
        // %MapIteratorPrototype%
        "MapIteratorPrototype": undefined,
        // %MapPrototype%
        "MapPrototype": _.Map.prototype,
        // %Math%
        "Math": _.Math,
        // %Number%
        "Number": _.Number,
        // %NumberPrototype%
        "NumberPrototype": _.Number.prototype,
        // %Object%
        "Object": _.Object,
        // %ObjectPrototype%
        "ObjectPrototype": _.Object.prototype,
        // %ObjProto_toString%
        "ObjProto_toString": _.Object.prototype.toString,
        // %ObjProto_valueOf%
        "ObjProto_valueOf": _.Object.prototype.valueOf,
        // %parseFloat%
        "parseFloat": _.parseFloat,
        // %parseInt%
        "parseInt": _.parseInt,
        // %Promise%
        "Promise": _.Promise,
        // %PromisePrototype%
        "PromisePrototype": _.Promise.prototype,
        // %Proxy%
        "Proxy": _.Proxy,
        // %RangeError%
        "RangeError": _.RangeError,
        // %RangeErrorPrototype%
        "RangeErrorPrototype": _.RangeError.prototype,
        // %ReferenceError%
        "ReferenceError": _.ReferenceError,
        // %ReferenceErrorPrototype%
        "ReferenceErrorPrototype": _.ReferenceError.prototype,
        // %Reflect%
        "Reflect": _.Reflect,
        // %RegExp%
        "RegExp": _.RegExp,
        // %RegExpPrototype%
        "RegExpPrototype": _.RegExp.prototype,
        // %Set%
        "Set": _.Set,
        // %SetIteratorPrototype%
        "SetIteratorPrototype": undefined,
        // %SetPrototype%
        "SetPrototype": _.Set.prototype,
        // %String%
        "String": _.String,
        // %StringIteratorPrototype%
        "StringIteratorPrototype": anonymousStringIteratorPrototype,
        // %StringPrototype%
        "StringPrototype": _.String.prototype,
        // %Symbol%
        "Symbol": _.Symbol,
        // %SymbolPrototype%
        "SymbolPrototype": _.Symbol.prototype,
        // %SyntaxError%
        "SyntaxError": _.SyntaxError,
        // %SyntaxErrorPrototype%
        "SyntaxErrorPrototype": _.SyntaxError.prototype,
        // %ThrowTypeError%
        "ThrowTypeError": undefined,
        // %TypedArray%
        "TypedArray": undefined,
        // %TypedArrayPrototype%
        "TypedArrayPrototype": undefined,
        // %TypeError%
        "TypeError": _.TypeError,
        // %TypeErrorPrototype%
        "TypeErrorPrototype": _.TypeError.prototype,
        // %Uint8Array%
        "Uint8Array": _.Uint8Array,
        // %Uint8ArrayPrototype%
        "Uint8ArrayPrototype": _.Uint8Array.prototype,
        // %Uint8ClampedArray%
        "Uint8ClampedArray": _.Uint8ClampedArray,
        // %Uint8ClampedArrayPrototype%
        "Uint8ClampedArrayPrototype": _.Uint8ClampedArray.prototype,
        // %Uint16Array%
        "Uint16Array": _.Uint16Array,
        // %Uint16ArrayPrototype%
        "Uint16ArrayPrototype": Uint16Array.prototype,
        // %Uint32Array%
        "Uint32Array": _.Uint32Array,
        // %Uint32ArrayPrototype%
        "Uint32ArrayPrototype": _.Uint32Array.prototype,
        // %URIError%
        "URIError": _.URIError,
        // %URIErrorPrototype%
        "URIErrorPrototype": _.URIError.prototype,
        // %WeakMap%
        "WeakMap": _.WeakMap,
        // %WeakMapPrototype%
        "WeakMapPrototype": _.WeakMap.prototype,
        // %WeakSet%
        "WeakSet": _.WeakSet,
        // %WeakSetPrototype%
        "WeakSetPrototype": _.WeakSet.prototype,
        
        // TODO: Annex B
        // TODO: other special cases

        // ESNext
        global: globalObject,
        Realm,
    };
}