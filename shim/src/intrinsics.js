import Realm from './realm';
import { getPrototypeOf } from './commons';

/**
 * Get the intrinsics not otherwise reachable by named own property traversal.
 * https://tc39.github.io/ecma262/#table-7
 */
function getAnonymousIntrinsics(global) {
  const SymbolIterator = (typeof global.Symbol && global.Symbol.iterator) || '@@iterator';

  const ArrayIteratorObject = new global.Array()[SymbolIterator]();
  const ArrayIteratorPrototype = getPrototypeOf(ArrayIteratorObject);
  const IteratorPrototype = getPrototypeOf(ArrayIteratorPrototype);

  const AsyncFunctionObject = global.eval('(async function(){})');
  const AsyncFunction = AsyncFunctionObject.constructor;
  const AsyncFunctionPrototype = AsyncFunction.prototype;

  const GeneratorFunctionObject = global.eval('(function*(){})');
  const GeneratorFunction = GeneratorFunctionObject.constructor;
  const Generator = GeneratorFunction.prototype;
  const GeneratorPrototype = Generator.prototype;

  const MapIteratorObject = new global.Map()[SymbolIterator]();
  const MapIteratorPrototype = getPrototypeOf(MapIteratorObject);

  const SetIteratorObject = new global.Set()[SymbolIterator]();
  const SetIteratorPrototype = getPrototypeOf(SetIteratorObject);

  const StringIteratorObject = new global.String()[SymbolIterator]();
  const StringIteratorPrototype = getPrototypeOf(StringIteratorObject);

  const ThrowTypeError = global.eval(
    '(function () { "use strict"; return Object.getOwnPropertyDescriptor(arguments, "callee").get; })()'
  );

  const TypedArrayObject = new global.Uint8Array();
  const TypedArray = getPrototypeOf(TypedArrayObject);
  const TypedArrayPrototype = TypedArray.prototype;

  return {

    // *** Table 7

    ArrayIteratorPrototype,
    AsyncFunction,
    AsyncFunctionPrototype,
    Generator,
    GeneratorFunction,
    GeneratorPrototype,
    IteratorPrototype,
    MapIteratorPrototype,
    SetIteratorPrototype,
    StringIteratorPrototype,
    ThrowTypeError,
    TypedArray,
    TypedArrayPrototype
  };
}

/**
 * Get the intrinsics from Table 7 & Annex B
 * https://tc39.github.io/ecma262/#table-7
 * https://tc39.github.io/ecma262/#table-73
 */
export function getIntrinsics(sandbox) {
  const { confinedWindow: global } = sandbox;

  const anonymous = getAnonymousIntrinsics(global);

  return {
    // *** Table 7

    // %Array%
    Array: global.Array,
    // %ArrayBuffer%
    ArrayBuffer: global.ArrayBuffer,
    // %ArrayBufferPrototype%
    ArrayBufferPrototype: global.ArrayBuffer.prototype,
    // %ArrayIteratorPrototype%
    ArrayIteratorPrototype: anonymous.ArrayIteratorPrototype,
    // %ArrayPrototype%
    ArrayPrototype: global.Array.prototype,
    // %ArrayProto_entries%
    ArrayProto_entries: global.Array.prototype.entries,
    // %ArrayProto_foreach%
    ArrayProto_foreach: global.Array.prototype.forEach,
    // %ArrayProto_keys%
    ArrayProto_keys: global.Array.prototype.forEach,
    // %ArrayProto_values%
    ArrayProto_values: global.Array.prototype.values,
    // %AsyncFunction%
    AsyncFunction: anonymous.AsyncFunction,
    // %AsyncFunctionPrototype%
    AsyncFunctionPrototype: anonymous.AsyncFunctionPrototype,
    // %Atomics%
    Atomics: global.Atomics,
    // %Boolean%
    Boolean: global.Boolean,
    // %BooleanPrototype%
    BooleanPrototype: global.Boolean.prototype,
    // %DataView%
    DataView: global.DataView,
    // %DataViewPrototype%
    DataViewPrototype: global.DataView.prototype,
    // %Date%
    Date: global.Date,
    // %DatePrototype%
    DatePrototype: global.Date.prototype,
    // %decodeURI%
    decodeURI: global.decodeURI,
    // %decodeURIComponent%
    decodeURIComponent: global.decodeURIComponent,
    // %encodeURI%
    encodeURI: global.encodeURI,
    // %encodeURIComponent%
    encodeURIComponent: global.encodeURIComponent,
    // %Error%
    Error: global.Error,
    // %ErrorPrototype%
    ErrorPrototype: global.Error.prototype,
    // %eval%
    eval: sandbox.eval,
    // %EvalError%
    EvalError: global.EvalError,
    // %EvalErrorPrototype%
    EvalErrorPrototype: global.EvalError.prototype,
    // %Float32Array%
    Float32Array: global.Float32Array,
    // %Float32ArrayPrototype%
    Float32ArrayPrototype: global.Float32Array.prototype,
    // %Float64Array%
    Float64Array: global.Float64Array,
    // %Float64ArrayPrototype%
    Float64ArrayPrototype: global.Float64Array.prototype,
    // %Function%
    Function: sandbox.Function,
    // %FunctionPrototype%
    FunctionPrototype: global.Function.prototype,
    // %Generator%
    Generator: anonymous.Generator,
    // %GeneratorFunction%
    GeneratorFunction: anonymous.GeneratorFunction,
    // %GeneratorPrototype%
    GeneratorPrototype: anonymous.GeneratorPrototype,
    // %Int8Array%
    Int8Array: global.Int8Array,
    // %Int8ArrayPrototype%
    Int8ArrayPrototype: global.Int8Array.prototype,
    // %Int16Array%
    Int16Array: global.Int16Array,
    // %Int16ArrayPrototype%,
    Int16ArrayPrototype: global.Int16Array.prototype,
    // %Int32Array%
    Int32Array: global.Int32Array,
    // %Int32ArrayPrototype%
    Int32ArrayPrototype: global.Int32Array.prototype,
    // %isFinite%
    isFinite: global.isFinite,
    // %isNaN%
    isNaN: global.isNaN,
    // %IteratorPrototype%
    IteratorPrototype: anonymous.IteratorPrototype,
    // %JSON%
    JSON: global.JSON,
    // %JSONParse%
    JSONParse: global.JSON.parse,
    // %Map%
    Map: global.Map,
    // %MapIteratorPrototype%
    MapIteratorPrototype: anonymous.MapIteratorPrototype,
    // %MapPrototype%
    MapPrototype: global.Map.prototype,
    // %Math%
    Math: global.Math,
    // %Number%
    Number: global.Number,
    // %NumberPrototype%
    NumberPrototype: global.Number.prototype,
    // %Object%
    Object: global.Object,
    // %ObjectPrototype%
    ObjectPrototype: global.Object.prototype,
    // %ObjProtoglobaltoString%
    ObjProtoglobaltoString: global.Object.prototype.toString,
    // %ObjProtoglobalvalueOf%
    ObjProtoglobalvalueOf: global.Object.prototype.valueOf,
    // %parseFloat%
    parseFloat: global.parseFloat,
    // %parseInt%
    parseInt: global.parseInt,
    // %Promise%
    Promise: global.Promise,
    // %Promise_all%
    Promise_all: global.Promise.all,
    // %Promise_reject%
    Promise_reject: global.Promise.reject,
    // %Promise_resolve%
    Promise_resolve: global.Promise.resolve,
    // %PromiseProto_then%
    PromiseProto_then: global.Promise.prototype.then,
    // %PromisePrototype%
    PromisePrototype: global.Promise.prototype,
    // %Proxy%
    Proxy: global.Proxy,
    // %RangeError%
    RangeError: global.RangeError,
    // %RangeErrorPrototype%
    RangeErrorPrototype: global.RangeError.prototype,
    // %ReferenceError%
    ReferenceError: global.ReferenceError,
    // %ReferenceErrorPrototype%
    ReferenceErrorPrototype: global.ReferenceError.prototype,
    // %Reflect%
    Reflect: global.Reflect,
    // %RegExp%
    RegExp: global.RegExp,
    // %RegExpPrototype%
    RegExpPrototype: global.RegExp.prototype,
    // %Set%
    Set: global.Set,
    // %SetIteratorPrototype%
    SetIteratorPrototype: anonymous.SetIteratorPrototype,
    // %SetPrototype%
    SetPrototype: global.Set.prototype,
    // %SharedArrayBuffer%
    SharedArrayBuffer: undefined, // DISABLED
    // %SharedArrayBufferPrototype%
    SharedArrayBufferPrototype: undefined, // DISABLED
    // %String%
    String: global.String,
    // %StringIteratorPrototype%
    StringIteratorPrototype: anonymous.StringIteratorPrototype,
    // %StringPrototype%
    StringPrototype: global.String.prototype,
    // %Symbol%
    Symbol: global.Symbol,
    // %SymbolPrototype%
    SymbolPrototype: global.Symbol.prototype,
    // %SyntaxError%
    SyntaxError: global.SyntaxError,
    // %SyntaxErrorPrototype%
    SyntaxErrorPrototype: global.SyntaxError.prototype,
    // %ThrowTypeError%
    ThrowTypeError: anonymous.ThrowTypeError,
    // %TypedArray%
    TypedArray: anonymous.TypedArray,
    // %TypedArrayPrototype%
    TypedArrayPrototype: anonymous.TypedArrayPrototype,
    // %TypeError%
    TypeError: global.TypeError,
    // %TypeErrorPrototype%
    TypeErrorPrototype: global.TypeError.prototype,
    // %Uint8Array%
    Uint8Array: global.Uint8Array,
    // %Uint8ArrayPrototype%
    Uint8ArrayPrototype: global.Uint8Array.prototype,
    // %Uint8ClampedArray%
    Uint8ClampedArray: global.Uint8ClampedArray,
    // %Uint8ClampedArrayPrototype%
    Uint8ClampedArrayPrototype: global.Uint8ClampedArray.prototype,
    // %Uint16Array%
    Uint16Array: global.Uint16Array,
    // %Uint16ArrayPrototype%
    Uint16ArrayPrototype: Uint16Array.prototype,
    // %Uint32Array%
    Uint32Array: global.Uint32Array,
    // %Uint32ArrayPrototype%
    Uint32ArrayPrototype: global.Uint32Array.prototype,
    // %URIError%
    URIError: global.URIError,
    // %URIErrorPrototype%
    URIErrorPrototype: global.URIError.prototype,
    // %WeakMap%
    WeakMap: global.WeakMap,
    // %WeakMapPrototype%
    WeakMapPrototype: global.WeakMap.prototype,
    // %WeakSet%
    WeakSet: global.WeakSet,
    // %WeakSetPrototype%
    WeakSetPrototype: global.WeakSet.prototype,

    // *** Annex B

    // %escape%
    escape: global.escape,
    // %unescape%
    unescape: global.unescape,

    // TODO: other special cases

    // *** ESNext
    Realm // intentionally passing around the Realm Constructor, which could be used as a side channel, but still!
  };
}
