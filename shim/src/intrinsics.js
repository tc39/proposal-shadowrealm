import { getPrototypeOf, defineProperty } from './commons';

/**
 * Get the intrinsics from Table 7 & Annex B
 * Named intrinsics: available as data properties of the global object.
 * Anonymous intrinsics: not otherwise reachable by own property name traversal.
 *
 * In preparation for placing, for example, the Function.prototype in the
 * intrinsics object from it will be accessible, first remove its
 * .contructor which currently points at the unsafe evaluator constructor.
 * Later, once we actually create the safe replacement constructors, we will
 * set these .contructor properties to point to them.
 *
 * https://tc39.github.io/ecma262/#table-7
 * https://tc39.github.io/ecma262/#table-73
 */
export function getFixedIntrinsics(contextGlobal) {
  const g = contextGlobal;

  // Anonymous intrinsics.

  const SymbolIterator = g.Symbol.iterator;

  const ArrayIteratorInstance = new g.Array()[SymbolIterator]();
  const ArrayIteratorPrototype = getPrototypeOf(ArrayIteratorInstance);
  const IteratorPrototype = getPrototypeOf(ArrayIteratorPrototype);

  // note: compartments share the intrinsics of their parent RootRealm, so
  // we'll have already fixed these intrinsics. This code should tolerate
  // fixing them multiple times.
  defineProperty(g.Function.prototype, "constructor", { value: void 0 });

  // Ensure parsing doesn't fail on platforms that don't support Async Functions.
  let AsyncFunctionInstance;
  try {
    AsyncFunctionInstance = g.eval('(async function(){})');
  } catch (e) {
    if (!(e instanceof g.SyntaxError)) {
      // Re-throw
      throw e;
    }
  }

  //const AsyncFunction = AsyncFunctionInstance && AsyncFunctionInstance.constructor;
  const AsyncFunctionPrototype = AsyncFunctionInstance && getPrototypeOf(AsyncFunctionInstance);
  if (AsyncFunctionInstance) {
    defineProperty(AsyncFunctionPrototype, "constructor", { value: void 0 });
  }

  // Ensure parsing doesn't fail on platforms that don't support Generator Functions.
  let GeneratorFunctionInstance;
  try {
    GeneratorFunctionInstance = g.eval('(function*(){})');
  } catch (e) {
    if (!(e instanceof g.SyntaxError)) {
      // Re-throw
      throw e;
    }
  }
  //const GeneratorFunction = GeneratorFunctionInstance && GeneratorFunctionInstance.constructor;
  const Generator = GeneratorFunctionInstance && getPrototypeOf(GeneratorFunctionInstance);
  const GeneratorPrototype = GeneratorFunctionInstance && Generator.prototype;
  if (GeneratorFunctionInstance) {
    defineProperty(Generator, "constructor", { value: void 0 });
    defineProperty(GeneratorPrototype, "constructor", { value: void 0 });
  }

  // Ensure parsing doesn't fail on platforms that don't support Async Generator Functions.
  let AsyncGeneratorFunctionInstance;
  try {
    AsyncGeneratorFunctionInstance = g.eval('(async function*(){})');
  } catch (e) {
    if (!(e instanceof g.SyntaxError)) {
      // Re-throw
      throw e;
    }
  }
  //const AsyncGeneratorFunction =
  //  AsyncGeneratorFunctionInstance && AsyncGeneratorFunctionInstance.constructor;
  const AsyncGenerator = AsyncGeneratorFunctionInstance && getPrototypeOf(AsyncGeneratorFunctionInstance);
  const AsyncGeneratorPrototype = AsyncGeneratorFunctionInstance && AsyncGenerator.prototype;
  if (AsyncGeneratorFunctionInstance) {
    defineProperty(AsyncGenerator, "constructor", { value: void 0 });
    defineProperty(AsyncGeneratorPrototype, "constructor", {value: void 0 });
  }

  const AsyncIteratorPrototype =
    AsyncGeneratorFunctionInstance && getPrototypeOf(AsyncGeneratorPrototype);
  // const AsyncFromSyncIteratorPrototype = undefined; // Not reacheable.

  const MapIteratorObject = new g.Map()[SymbolIterator]();
  const MapIteratorPrototype = getPrototypeOf(MapIteratorObject);

  const SetIteratorObject = new g.Set()[SymbolIterator]();
  const SetIteratorPrototype = getPrototypeOf(SetIteratorObject);

  const StringIteratorObject = new g.String()[SymbolIterator]();
  const StringIteratorPrototype = getPrototypeOf(StringIteratorObject);

  const ThrowTypeError = g.eval(
    '(function () { "use strict"; return Object.getOwnPropertyDescriptor(arguments, "callee").get; })()'
  );

  const TypedArray = getPrototypeOf(g.Int8Array);
  const TypedArrayPrototype = TypedArray.prototype;

  // Named intrinsics

  const sharedIntrinsics = {
    // *** Table 7

    // %Array%
    Array: g.Array,
    // %ArrayBuffer%
    ArrayBuffer: g.ArrayBuffer,
    // %ArrayBufferPrototype%
    ArrayBufferPrototype: g.ArrayBuffer.prototype,
    // %ArrayIteratorPrototype%
    ArrayIteratorPrototype,
    // %ArrayPrototype%
    ArrayPrototype: g.Array.prototype,
    // %ArrayProto_entries%
    ArrayProto_entries: g.Array.prototype.entries,
    // %ArrayProto_foreach%
    ArrayProto_foreach: g.Array.prototype.forEach,
    // %ArrayProto_keys%
    ArrayProto_keys: g.Array.prototype.forEach,
    // %ArrayProto_values%
    ArrayProto_values: g.Array.prototype.values,
    // %AsyncFromSyncIteratorPrototype%
    // AsyncFromSyncIteratorPrototype, // Not reachable
    // %AsyncFunctionPrototype%
    AsyncFunctionPrototype,
    // %AsyncGeneratorPrototype%
    AsyncGeneratorPrototype,
    // %AsyncIteratorPrototype%
    AsyncIteratorPrototype,
    // %Atomics%
    // Atomics: g.Atomics, // Deprecated on Jan 5, 2018
    // %Boolean%
    Boolean: g.Boolean,
    // %BooleanPrototype%
    BooleanPrototype: g.Boolean.prototype,
    // %DataView%
    DataView: g.DataView,
    // %DataViewPrototype%
    DataViewPrototype: g.DataView.prototype,
    // %Date%
    Date: g.Date,
    // %DatePrototype%
    DatePrototype: g.Date.prototype,
    // %decodeURI%
    decodeURI: g.decodeURI,
    // %decodeURIComponent%
    decodeURIComponent: g.decodeURIComponent,
    // %encodeURI%
    encodeURI: g.encodeURI,
    // %encodeURIComponent%
    encodeURIComponent: g.encodeURIComponent,
    // %Error%
    Error: g.Error,
    // %ErrorPrototype%
    ErrorPrototype: g.Error.prototype,
    // %EvalError%
    EvalError: g.EvalError,
    // %EvalErrorPrototype%
    EvalErrorPrototype: g.EvalError.prototype,
    // %Float32Array%
    Float32Array: g.Float32Array,
    // %Float32ArrayPrototype%
    Float32ArrayPrototype: g.Float32Array.prototype,
    // %Float64Array%
    Float64Array: g.Float64Array,
    // %Float64ArrayPrototype%
    Float64ArrayPrototype: g.Float64Array.prototype,
    // %FunctionPrototype%
    FunctionPrototype: g.Function.prototype,
    // %GeneratorPrototype%
    GeneratorPrototype,
    // %Int8Array%
    Int8Array: g.Int8Array,
    // %Int8ArrayPrototype%
    Int8ArrayPrototype: g.Int8Array.prototype,
    // %Int16Array%
    Int16Array: g.Int16Array,
    // %Int16ArrayPrototype%,
    Int16ArrayPrototype: g.Int16Array.prototype,
    // %Int32Array%
    Int32Array: g.Int32Array,
    // %Int32ArrayPrototype%
    Int32ArrayPrototype: g.Int32Array.prototype,
    // %isFinite%
    isFinite: g.isFinite,
    // %isNaN%
    isNaN: g.isNaN,
    // %IteratorPrototype%
    IteratorPrototype,
    // %JSON%
    JSON: g.JSON,
    // %JSONParse%
    JSONParse: g.JSON.parse,
    // %Map%
    Map: g.Map,
    // %MapIteratorPrototype%
    MapIteratorPrototype,
    // %MapPrototype%
    MapPrototype: g.Map.prototype,
    // %Math%
    Math: g.Math,
    // %Number%
    Number: g.Number,
    // %NumberPrototype%
    NumberPrototype: g.Number.prototype,
    // %Object%
    Object: g.Object,
    // %ObjectPrototype%
    ObjectPrototype: g.Object.prototype,
    // %ObjProto_toString%
    ObjProto_toString: g.Object.prototype.toString,
    // %ObjProto_valueOf%
    ObjProto_valueOf: g.Object.prototype.valueOf,
    // %parseFloat%
    parseFloat: g.parseFloat,
    // %parseInt%
    parseInt: g.parseInt,
    // %Promise%
    Promise: g.Promise,
    // %Promise_all%
    Promise_all: g.Promise.all,
    // %Promise_reject%
    Promise_reject: g.Promise.reject,
    // %Promise_resolve%
    Promise_resolve: g.Promise.resolve,
    // %PromiseProto_then%
    PromiseProto_then: g.Promise.prototype.then,
    // %PromisePrototype%
    PromisePrototype: g.Promise.prototype,
    // %Proxy%
    Proxy: g.Proxy,
    // %RangeError%
    RangeError: g.RangeError,
    // %RangeErrorPrototype%
    RangeErrorPrototype: g.RangeError.prototype,
    // %ReferenceError%
    ReferenceError: g.ReferenceError,
    // %ReferenceErrorPrototype%
    ReferenceErrorPrototype: g.ReferenceError.prototype,
    // %Reflect%
    Reflect: g.Reflect,
    // %RegExp%
    RegExp: g.RegExp,
    // %RegExpPrototype%
    RegExpPrototype: g.RegExp.prototype,
    // %Set%
    Set: g.Set,
    // %SetIteratorPrototype%
    SetIteratorPrototype,
    // %SetPrototype%
    SetPrototype: g.Set.prototype,
    // %SharedArrayBuffer%
    // SharedArrayBuffer // Deprecated on Jan 5, 2018
    // %SharedArrayBufferPrototype%
    // SharedArrayBufferPrototype // Deprecated on Jan 5, 2018
    // %String%
    String: g.String,
    // %StringIteratorPrototype%
    StringIteratorPrototype,
    // %StringPrototype%
    StringPrototype: g.String.prototype,
    // %Symbol%
    Symbol: g.Symbol,
    // %SymbolPrototype%
    SymbolPrototype: g.Symbol.prototype,
    // %SyntaxError%
    SyntaxError: g.SyntaxError,
    // %SyntaxErrorPrototype%
    SyntaxErrorPrototype: g.SyntaxError.prototype,
    // %ThrowTypeError%
    ThrowTypeError,
    // %TypedArray%
    TypedArray,
    // %TypedArrayPrototype%
    TypedArrayPrototype,
    // %TypeError%
    TypeError: g.TypeError,
    // %TypeErrorPrototype%
    TypeErrorPrototype: g.TypeError.prototype,
    // %Uint8Array%
    Uint8Array: g.Uint8Array,
    // %Uint8ArrayPrototype%
    Uint8ArrayPrototype: g.Uint8Array.prototype,
    // %Uint8ClampedArray%
    Uint8ClampedArray: g.Uint8ClampedArray,
    // %Uint8ClampedArrayPrototype%
    Uint8ClampedArrayPrototype: g.Uint8ClampedArray.prototype,
    // %Uint16Array%
    Uint16Array: g.Uint16Array,
    // %Uint16ArrayPrototype%
    Uint16ArrayPrototype: g.Uint16Array.prototype,
    // %Uint32Array%
    Uint32Array: g.Uint32Array,
    // %Uint32ArrayPrototype%
    Uint32ArrayPrototype: g.Uint32Array.prototype,
    // %URIError%
    URIError: g.URIError,
    // %URIErrorPrototype%
    URIErrorPrototype: g.URIError.prototype,
    // %WeakMap%
    WeakMap: g.WeakMap,
    // %WeakMapPrototype%
    WeakMapPrototype: g.WeakMap.prototype,
    // %WeakSet%
    WeakSet: g.WeakSet,
    // %WeakSetPrototype%
    WeakSetPrototype: g.WeakSet.prototype,

    // *** Annex B

    // %escape%
    escape: g.escape,
    // %unescape%
    unescape: g.unescape,

    // *** ECMA-402

    Intl: g.Intl,

    // *** ESNext.
    // This is in sharedIntrinsics because there's only one Realm constructor
    // per RootRealm even though there's one Realm instance per Realm.
    // Compartments use the Realm constructor from their parent RootRealm.
    Realm: g.Realm
  };

  const evaluators = {
    // %AsyncFunction%
    //AsyncFunction,
    // %AsyncGenerator%
    //AsyncGenerator,
    // %AsyncGeneratorFunction%
    //AsyncGeneratorFunction,
    // %eval%
    eval: g.eval,
    // %Function%
    Function: g.Function,
    // %Generator%
    //Generator,
    // %GeneratorFunction%
    //GeneratorFunction,
  };

  // sharedIntrinsics are per RootRealm, while evaluators are per Realm,
  // i.e., one for each RootRealm and one for each Compartment.
  return {sharedIntrinsics, evaluators};
}
