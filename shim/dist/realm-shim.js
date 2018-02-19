(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.RealmShim = factory());
}(this, (function () { 'use strict';

// Declare shorthand functions. Sharing these declarations accross modules
// improves both consitency and minification. Unused declarations are dropped
// by the tree shaking process.

var assign = Object.assign;
var create = Object.create;
var defineProperties = Object.defineProperties;
var getOwnPropertyNames = Object.getOwnPropertyNames;
var defineProperty = Reflect.defineProperty;
var deleteProperty = Reflect.deleteProperty;
var getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
var getPrototypeOf = Reflect.getPrototypeOf;
var setPrototypeOf = Reflect.setPrototypeOf;

// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

// Fix legacy accessors to comply with strict mode and ES2016 semantics,
// we need to redefine them while in strict mode.
// https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__

function repairAccessors(objProto) {

    try {

        defineProperty(objProto, '__defineGetter__', {
            value: function value(prop, func) {
                return defineProperty(this, prop, {
                    get: func,
                    enumerable: true,
                    configurable: true
                });
            }
        });

        defineProperty(objProto, '__defineSetter__', {
            value: function value(prop, func) {
                return defineProperty(this, prop, {
                    set: func,
                    enumerable: true,
                    configurable: true
                });
            }
        });

        defineProperty(objProto, '__lookupGetter__', {
            value: function value(prop) {
                var base = this;
                var desc = void 0;
                while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
                    base = getPrototypeOf(base);
                }
                return desc && desc.get;
            }
        });

        defineProperty(objProto, '__lookupSetter__', {
            value: function value(prop) {
                var base = this;
                var desc = void 0;
                while (base && !(desc = getOwnPropertyDescriptor(base, prop))) {
                    base = getPrototypeOf(base);
                }
                return desc && desc.set;
            }
        });
    } catch (ignore) {
        // Ignored
    }
}

// locking down the environment
function sanitize(sandbox) {
    var objProto = sandbox.confinedWindow.Object.prototype;


    repairAccessors(objProto);
    // TODO: other steps
}

// this flag allow us to determine if the eval() call is a controlled eval done by the realm's code
// or if it is user-land invocation, so we can react differently.
var isInternalEvaluation = false;

function setInternalEvaluation() {
    isInternalEvaluation = true;
}

function resetInternalEvaluation() {
    isInternalEvaluation = false;
}

var proxyHandler = {
    get: function get(sandbox, propName) {
        if (propName === 'eval' && isInternalEvaluation) {
            resetInternalEvaluation();
            return sandbox.confinedWindow.eval;
        }
        return sandbox.globalObject[propName];
    },
    set: function set(sandbox, propName, newValue) {
        sandbox.globalObject[propName] = newValue;
        return true;
    },
    defineProperty: function defineProperty$$1(sandbox, propName, descriptor) {
        defineProperty(sandbox.globalObject, propName, descriptor);
        return true;
    },
    deleteProperty: function deleteProperty$$1(sandbox, propName) {
        return deleteProperty(sandbox.globalObject, propName);
    },
    has: function has(sandbox, propName) {
        if (propName === 'eval' && isInternalEvaluation) {
            return true;
        }
        if (propName in sandbox.globalObject) {
            return true;
        } else if (propName in sandbox.confinedWindow) {
            throw new ReferenceError(propName + ' is not defined. If you are using typeof ' + propName + ', you can change your program to use typeof global.' + propName + ' instead');
        }
        return false;
    },
    ownKeys: function ownKeys$$1(sandbox) {
        return getOwnPropertyNames(sandbox.globalObject);
    },
    getOwnPropertyDescriptor: function getOwnPropertyDescriptor$$1(sandbox, propName) {
        return getOwnPropertyDescriptor(sandbox.globalObject, propName);
    },
    isExtensible: function isExtensible(sandbox) {
        // TODO: can it becomes non-extensible?
        return true;
    },
    getPrototypeOf: function getPrototypeOf$$1(sandbox) {
        return null;
    },
    setPrototypeOf: function setPrototypeOf$$1(sandbox, prototype) {
        return prototype === null ? true : false;
    }
};

var HookFnName = '$RealmEvaluatorIIFE$';

// Wrapping the source with `with` statement creates a new lexical scope,
// that can prevent access to the globals in the sandbox by shadowing them
// via globalProxy.
function addLexicalScopesToSource(sourceText) {
    /**
     * We use a `with` statement who uses `argments[0]`, which is the
     * `sandbox.globalProxy` that implements the shadowing mechanism as well as access to
     * any global variable.
     * Aside from that, the `this` value in sourceText will correspond to `sandbox.thisValue`.
     * We have to use `arguments` instead of naming them to avoid name collision.
     */
    // escaping backsticks to prevent leaking the original eval as well as syntax errors
    sourceText = sourceText.replace(/\`/g, '\\`');
    return '\n        function ' + HookFnName + '() {\n            with(arguments[0]) {\n                return (function(){\n                    "use strict";\n                    return eval(`' + sourceText + '`);\n                }).call(this);\n            }\n        }\n    ';
}

function evalAndReturn(sourceText, sandbox) {
    var iframeDocument = sandbox.iframeDocument,
        confinedWindow = sandbox.confinedWindow;
    var iframeBody = iframeDocument.body;

    var script = iframeDocument.createElement('script');
    script.type = 'text/javascript';
    confinedWindow[HookFnName] = undefined;
    script.appendChild(iframeDocument.createTextNode(sourceText));
    iframeBody.appendChild(script);
    iframeBody.removeChild(script);
    var result = confinedWindow[HookFnName];
    confinedWindow[HookFnName] = undefined;
    return result;
}

function evaluate(sourceText, sandbox) {
    if (!sourceText) {
        return undefined;
    }
    sourceText = addLexicalScopesToSource(sourceText + '');
    setInternalEvaluation();
    var fn = evalAndReturn(sourceText, sandbox);
    var result = fn.apply(sandbox.thisValue, [sandbox.globalProxy]);
    resetInternalEvaluation();
    return result;
}

function getEvalEvaluator(sandbox) {
    var o = {
        // trick to set the name of the function to "eval"
        eval: function _eval(sourceText) {
            // console.log(`Shim-Evaluation: "${sourceText}"`);
            return evaluate(sourceText, sandbox);
        }
    };
    setPrototypeOf(o.eval, sandbox.Function);
    o.eval.toString = function () {
        return 'function eval() { [shim code] }';
    };
    return o.eval;
}

function getFunctionEvaluator(sandbox) {
    var confinedWindow = sandbox.confinedWindow;

    var f = function Function() {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
        }

        // console.log(`Shim-Evaluation: Function("${args.join('", "')}")`);
        var sourceText = args.pop();
        var fnArgs = args.join(', ');
        return evaluate("(function anonymous(" + fnArgs + "){\n" + sourceText + "\n}).bind(this)", sandbox);
    };
    f.prototype = confinedWindow.Function.prototype;
    setPrototypeOf(f, f.prototype);
    f.prototype.constructor = f;
    f.toString = function () {
        return 'function Function() { [shim code] }';
    };
    return f;
}

function getEvaluators(sandbox) {
    sandbox.Function = getFunctionEvaluator(sandbox);
    sandbox.eval = getEvalEvaluator(sandbox);
}

function createIframe() {
    var el = document.createElement("iframe");
    el.style.display = "none";
    // accessibility
    el.title = "script";
    el.setAttribute('aria-hidden', true);
    document.body.appendChild(el);
    return el;
}

function createSandbox() {
    var iframe = createIframe();
    var iframeDocument = iframe.contentDocument,
        confinedWindow = iframe.contentWindow;

    var sandbox = {
        iframe: iframe,
        iframeDocument: iframeDocument,
        confinedWindow: confinedWindow,
        thisValue: undefined,
        globalObject: undefined,
        globalProxy: undefined
    };
    sanitize(sandbox);
    assign(sandbox, getEvaluators(sandbox));
    sandbox.globalProxy = new Proxy(sandbox, proxyHandler);
    return sandbox;
}

function setSandboxGlobalObject(sandbox, globalObject, thisValue) {
    sandbox.thisValue = thisValue;
    sandbox.globalObject = globalObject;
}

var _typeof$1 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Get the intrinsics from Table 7 & Annex B
 * https://tc39.github.io/ecma262/#table-7
 * https://tc39.github.io/ecma262/#table-73
 */
function getIntrinsics(sandbox) {
    var global = sandbox.confinedWindow;

    // Anonymous intrinsics.

    var SymbolIterator = _typeof$1(global.Symbol) && global.Symbol.iterator || "@@iterator";

    var ArrayIteratorInstance = new global.Array()[SymbolIterator]();
    var ArrayIteratorPrototype = getPrototypeOf(ArrayIteratorInstance);
    var IteratorPrototype = getPrototypeOf(ArrayIteratorPrototype);

    var AsyncFunctionInstance = global.eval("(async function(){})");
    var AsyncFunction = AsyncFunctionInstance.constructor;
    var AsyncFunctionPrototype = AsyncFunction.prototype;

    var GeneratorFunctionInstance = global.eval("(function*(){})");
    var GeneratorFunction = GeneratorFunctionInstance.constructor;
    var Generator = GeneratorFunction.prototype;
    var GeneratorPrototype = Generator.prototype;

    var AsyncGeneratorFunctionInstance = void 0;
    try {
        AsyncGeneratorFunctionInstance = global.eval('(async function*(){})');
    } catch (e) {
        /* unsupported */
    }
    var AsyncGeneratorFunction = AsyncGeneratorFunctionInstance && AsyncGeneratorFunctionInstance.constructor;
    var AsyncGenerator = AsyncGeneratorFunctionInstance && AsyncGeneratorFunction.prototype;
    var AsyncGeneratorPrototype = AsyncGeneratorFunctionInstance && AsyncGenerator.prototype;

    var AsyncFromSyncIteratorPrototype = AsyncGeneratorFunctionInstance && undefined; // TODO
    var AsyncIteratorPrototype = AsyncGeneratorFunctionInstance && getPrototypeOf(AsyncGeneratorPrototype);

    var MapIteratorObject = new global.Map()[SymbolIterator]();
    var MapIteratorPrototype = getPrototypeOf(MapIteratorObject);

    var SetIteratorObject = new global.Set()[SymbolIterator]();
    var SetIteratorPrototype = getPrototypeOf(SetIteratorObject);

    var StringIteratorObject = new global.String()[SymbolIterator]();
    var StringIteratorPrototype = getPrototypeOf(StringIteratorObject);

    var ThrowTypeError = global.eval('(function () { "use strict"; return Object.getOwnPropertyDescriptor(arguments, "callee").get; })()');

    var TypedArray = getPrototypeOf(Int8Array);
    var TypedArrayPrototype = TypedArray.prototype;

    // Named intrinsics

    return {
        // *** Table 7

        // %Array%
        Array: global.Array,
        // %ArrayBuffer%
        ArrayBuffer: global.ArrayBuffer,
        // %ArrayBufferPrototype%
        ArrayBufferPrototype: global.ArrayBuffer.prototype,
        // %ArrayIteratorPrototype%
        ArrayIteratorPrototype: ArrayIteratorPrototype,
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
        // %AsyncFromSyncIteratorPrototype%
        AsyncFromSyncIteratorPrototype: AsyncFromSyncIteratorPrototype,
        // %AsyncFunction%
        AsyncFunction: AsyncFunction,
        // %AsyncFunctionPrototype%
        AsyncFunctionPrototype: AsyncFunctionPrototype,
        // %AsyncGenerator%
        AsyncGenerator: AsyncGenerator,
        // %AsyncGeneratorFunction%
        AsyncGeneratorFunction: AsyncGeneratorFunction,
        // %AsyncGeneratorPrototype%
        AsyncGeneratorPrototype: AsyncGeneratorPrototype,
        // %AsyncIteratorPrototype%
        AsyncIteratorPrototype: AsyncIteratorPrototype,
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
        FunctionPrototype: sandbox.Function.prototype,
        // %Generator%
        Generator: Generator,
        // %GeneratorFunction%
        GeneratorFunction: GeneratorFunction,
        // %GeneratorPrototype%
        GeneratorPrototype: GeneratorPrototype,
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
        IteratorPrototype: IteratorPrototype,
        // %JSON%
        JSON: global.JSON,
        // %JSONParse%
        JSONParse: global.JSON.parse,
        // %Map%
        Map: global.Map,
        // %MapIteratorPrototype%
        MapIteratorPrototype: MapIteratorPrototype,
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
        // %ObjProto_toString%
        ObjProto_toString: global.Object.prototype.toString,
        // %ObjProto_valueOf%
        ObjProto_valueOf: global.Object.prototype.valueOf,
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
        SetIteratorPrototype: SetIteratorPrototype,
        // %SetPrototype%
        SetPrototype: global.Set.prototype,
        // %SharedArrayBuffer%
        // SharedArrayBuffer: undefined, // Deprecated on Jan 5, 2018
        // %SharedArrayBufferPrototype%
        // SharedArrayBufferPrototype: undefined, // Deprecated on Jan 5, 2018
        // %String%
        String: global.String,
        // %StringIteratorPrototype%
        StringIteratorPrototype: StringIteratorPrototype,
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
        ThrowTypeError: ThrowTypeError,
        // %TypedArray%
        TypedArray: TypedArray,
        // %TypedArrayPrototype%
        TypedArrayPrototype: TypedArrayPrototype,
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

        // TODO: Other special cases

        // *** ESNext
        Realm: Realm // intentionally passing around the Realm Constructor, which could be used as a side channel, but still!
    };
}

function getStdLib(sandbox) {
    var intrinsics = getIntrinsics(sandbox);

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

function assert(condition) {
    if (!condition) {
        throw new Error();
    }
}

function IsCallable(obj) {
    return typeof obj === 'function';
}

var _createClass = function () { function defineProperties$$1(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties$$1(Constructor.prototype, protoProps); if (staticProps) defineProperties$$1(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var RealmRecord = Symbol('Realm Slot');
var Intrinsics = Symbol('Intrinsics Slot');
var GlobalObject = Symbol('GlobalObject Slot');
var GlobalThisValue = Symbol('GlobalThisValue Slot');
var GlobalEnv = Symbol('GlobalEnv Slot');
var EvalHook = Symbol('EvalHook Slot');
var IsDirectEvalHook = Symbol('IsDirectEvalHook Slot');
var ImportHook = Symbol('ImportHook Slot');
var ImportMetaHook = Symbol('ImportMetaHook Slot');
var ShimSandbox = Symbol('Sandbox');

// shim specific
function getSandbox(realmRec) {
    var sandbox = realmRec[ShimSandbox];
    assert((typeof sandbox === "undefined" ? "undefined" : _typeof(sandbox)) === 'object');
    return sandbox;
}

function getCurrentRealmRecord() {
    var realmRec = window[RealmRecord];
    if (!realmRec) {
        // this is an outer realm, and we should set up the RealmRecord
        window[RealmRecord] = {
            // TODO: mimic what the global realm record should have
            // including default hooks, etc.
        };
    }
    return realmRec;
}

// <!-- es6num="8.1.2.5" -->
function NewGlobalEnvironment(G, thisValue) {
    // diverging from spec to accomodate the iframe as the lexical environment
    // using a class for better debugability
    var EnvironmentRecord = function EnvironmentRecord() /*globalObject*/{
        _classCallCheck(this, EnvironmentRecord);

        this[GlobalThisValue] = thisValue;
    };

    return new EnvironmentRecord(G);
}

// <!-- es6num="8.2.3" -->
function SetRealmGlobalObject(realmRec, globalObj, thisValue) {
    if (globalObj === undefined) {
        var intrinsics = realmRec[Intrinsics];
        globalObj = create(intrinsics['ObjectPrototype']);
    }
    assert((typeof globalObj === "undefined" ? "undefined" : _typeof(globalObj)) === 'object');
    if (thisValue === undefined) thisValue = globalObj;
    realmRec[GlobalObject] = globalObj;
    var newGlobalEnv = NewGlobalEnvironment(globalObj, thisValue);
    realmRec[GlobalEnv] = newGlobalEnv;
    return realmRec;
}

// <!-- es6num="8.2.4" -->
function SetDefaultGlobalBindings(realmRec) {
    var global = realmRec[GlobalObject];
    // For each property of the Global Object specified in clause <emu-xref href="#sec-global-object"></emu-xref>, do
    // ---> diverging:
    var GlobalObjectDescriptors = getStdLib(realmRec[ShimSandbox]);
    defineProperties(global, GlobalObjectDescriptors);
    return global;
}

// <!-- es6num="8.2.2" -->
function CreateIntrinsics(realmRec) {
    // ---> diverging
    var intrinsics = getIntrinsics(realmRec[ShimSandbox]);
    realmRec[Intrinsics] = intrinsics;
    return intrinsics;
}

function CreateRealmRec(intrinsics) {
    var _realmRec;

    var realmRec = (_realmRec = {}, _defineProperty(_realmRec, Intrinsics, {}), _defineProperty(_realmRec, GlobalObject, undefined), _defineProperty(_realmRec, GlobalEnv, undefined), _defineProperty(_realmRec, EvalHook, undefined), _defineProperty(_realmRec, IsDirectEvalHook, undefined), _defineProperty(_realmRec, ImportHook, undefined), _defineProperty(_realmRec, ImportMetaHook, undefined), _defineProperty(_realmRec, ShimSandbox, createSandbox()), _realmRec);
    if (intrinsics === undefined) {
        CreateIntrinsics(realmRec);
    } else {
        // 1. Assert: In this case, _intrinsics_ must be a Record with field names listed in column one of Table 7.
        realmRec[Intrinsics] = intrinsics;
    }
    return realmRec;
}

function InvokeDirectEvalHook(realmRec, x) {
    // 1. Assert: realm is a Realm Record.
    var fn = realmRec[EvalHook];
    if (fn === undefined) return x;
    assert(IsCallable(fn) === true);
    return fn.call(undefined, x);
}

// <!-- es6num="18.2.1.1" -->
function PerformEval(x, evalRealm, strictCaller, direct) {
    assert(direct === false ? strictCaller === false : true);
    // realm spec segment begins
    if (direct === true) {
        x = InvokeDirectEvalHook(x, evalRealm);
    }
    // realm spec segment ends
    if (typeof x !== 'string') return x;
    // ---> diverging
    var sandbox = getSandbox(evalRealm);
    return evaluate(x, sandbox);
}

var Realm = function () {
    function Realm(options) {
        _classCallCheck(this, Realm);

        var O = this;
        var parentRealm = getCurrentRealmRecord();
        var opts = Object(options);
        var importHook = opts.importHook;
        if (importHook === "inherit") {
            importHook = parentRealm[ImportHook];
        } else if (importHook !== undefined && IsCallable(importHook) === false) throw new TypeError();
        var importMetaHook = opts.importMetaHook;
        if (importMetaHook === "inherit") {
            importMetaHook = parentRealm[ImportMetaHook];
        } else if (importMetaHook !== undefined && IsCallable(importMetaHook) === false) throw new TypeError();
        var evalHook = opts.evalHook;
        if (evalHook === "inherit") {
            evalHook = parentRealm[EvalHook];
        } else if (evalHook !== undefined && IsCallable(evalHook) === false) throw new TypeError();
        var isDirectEvalHook = opts.isDirectEvalHook;
        if (isDirectEvalHook === "inherit") {
            isDirectEvalHook = parentRealm[IsDirectEvalHook];
        } else if (isDirectEvalHook !== undefined && IsCallable(isDirectEvalHook) === false) throw new TypeError();
        var intrinsics = opts.intrinsics;
        if (intrinsics === "inherit") {
            intrinsics = parentRealm[Intrinsics];
        } else if (intrinsics !== undefined) throw new TypeError();
        var thisValue = opts.thisValue;
        if (thisValue !== undefined && (typeof thisValue === "undefined" ? "undefined" : _typeof(thisValue)) !== "object") throw new TypeError();
        var realmRec = CreateRealmRec(intrinsics);
        O[RealmRecord] = realmRec;
        SetRealmGlobalObject(realmRec, undefined, thisValue);
        if (importHook === undefined) {
            // new built-in function object as defined in <emu-xref href="#sec-realm-default-import-hook-functions"></emu-xref>
            importHook = function importHook() /*referrer, specifier*/{
                throw new TypeError();
            };
        }
        realmRec[ImportHook] = importHook;
        if (evalHook !== undefined) {
            realmRec[EvalHook] = evalHook;
        }
        if (isDirectEvalHook !== undefined) {
            realmRec[IsDirectEvalHook] = isDirectEvalHook;
        }
        var init = O.init;
        if (!IsCallable(init)) throw new TypeError();
        init.call(O);
        // ---> diverging
        setSandboxGlobalObject(realmRec[ShimSandbox], realmRec[GlobalObject], realmRec[GlobalEnv][GlobalThisValue]);
    }

    _createClass(Realm, [{
        key: "init",
        value: function init() {
            var O = this;
            if ((typeof O === "undefined" ? "undefined" : _typeof(O)) !== 'object') throw new TypeError();
            if (!(RealmRecord in O)) throw new TypeError();
            SetDefaultGlobalBindings(O[RealmRecord]);
        }
    }, {
        key: "eval",
        value: function _eval(x) {
            var O = this;
            if ((typeof O === "undefined" ? "undefined" : _typeof(O)) !== 'object') throw new TypeError();
            if (!(RealmRecord in O)) throw new TypeError();
            var evalRealm = O[RealmRecord];
            // HostEnsureCanCompileStrings(the current Realm Record, _evalRealm_).
            return PerformEval(x, evalRealm, false, false);
        }
    }, {
        key: "stdlib",
        get: function get() {
            var O = this;
            if ((typeof O === "undefined" ? "undefined" : _typeof(O)) !== 'object') throw new TypeError();
            if (!(RealmRecord in O)) throw new TypeError();
            // TODO: align with spec
            var sandbox = getSandbox(O[RealmRecord]);
            return getStdLib(sandbox);
        }
    }, {
        key: "intrinsics",
        get: function get() {
            var O = this;
            if ((typeof O === "undefined" ? "undefined" : _typeof(O)) !== 'object') throw new TypeError();
            if (!(RealmRecord in O)) throw new TypeError();
            // TODO: align with spec
            var sandbox = getSandbox(O[RealmRecord]);
            return getIntrinsics(sandbox.confinedWindow);
        }
    }, {
        key: "global",
        get: function get() {
            var O = this;
            if ((typeof O === "undefined" ? "undefined" : _typeof(O)) !== 'object') throw new TypeError();
            if (!(RealmRecord in O)) throw new TypeError();
            return O[RealmRecord][GlobalObject];
        }
    }, {
        key: "thisValue",
        get: function get() {
            var O = this;
            if ((typeof O === "undefined" ? "undefined" : _typeof(O)) !== 'object') throw new TypeError();
            if (!(RealmRecord in O)) throw new TypeError();
            var envRec = O[RealmRecord][GlobalEnv];
            return envRec[GlobalThisValue];
        }
    }]);

    return Realm;
}();

Realm.toString = function () {
    return 'function Realm() { [shim code] }';
};

return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
