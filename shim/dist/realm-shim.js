(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.RealmShim = factory());
}(this, (function () { 'use strict';

function createIframe() {
    var el = document.createElement("iframe");
    el.style.display = "none";
    // accessibility
    el.title = "script";
    el.setAttribute('aria-hidden', true);
    document.body.appendChild(el);
    return el;
}

function getWindshield(iframe) {
    if (windshieldCache) {
        return windshieldCache;
    }
    var confinedWindow = iframe.contentWindow;

    var windshieldCache = confinedWindow.Object.create(null);
    /**
     * This is a one time operation to create this giant object with a bunch of properties
     * set to `undefined` to shadow every global binding in iframes' `window`.
     * This object will be used as the base lexical scope when evaluating source text
     * inside any realm. It can be reused because it has no authority, and it should always
     * be the same since the window object of a brand new iframe is always the same as well.
     */
    Object.getOwnPropertyNames(confinedWindow).forEach(function (name) {
        // TODO: recursive to cover WindowPrototype properties as well
        Object.defineProperty(windshieldCache, name, {
            value: undefined,
            enumerable: false,
            configurable: false,
            writable: false
        });
    });
    Object.freeze(windshieldCache);
    return windshieldCache;
}

function createSandbox() {
    var iframe = createIframe();
    var iframeDocument = iframe.contentDocument,
        confinedWindow = iframe.contentWindow;

    var windshield = getWindshield(iframe);
    return {
        windshield: windshield,
        iframe: iframe,
        iframeDocument: iframeDocument,
        confinedWindow: confinedWindow
    };
}

// locking down the environment
function sanitize(sandbox) {
    var _sandbox$confinedWind = sandbox.confinedWindow,
        Object = _sandbox$confinedWind.Object,
        parentObject = _sandbox$confinedWind.parent.Object;

    try {
        // Fixing properties of Object to comply with strict mode
        // and ES2016 semantics, we do this by redefining them while in 'use strict'
        // https://tc39.github.io/ecma262/#sec-object.prototype.__defineGetter__
        [Object, parentObject].forEach(function (o) {
            if (o === undefined) {
                return;
            }
            o.defineProperty(o.prototype, '__defineGetter__', {
                value: function value(key, fn) {
                    return o.defineProperty(this, key, {
                        get: fn
                    });
                }
            });
            o.defineProperty(o.prototype, '__defineSetter__', {
                value: function value(key, fn) {
                    return o.defineProperty(this, key, {
                        set: fn
                    });
                }
            });
            o.defineProperty(o.prototype, '__lookupGetter__', {
                value: function value(key) {
                    var d,
                        p = this;
                    while (p && (d = o.getOwnPropertyDescriptor(p, key)) === undefined) {
                        p = o.getPrototypeOf(this);
                    }
                    return d ? d.get : undefined;
                }
            });
            o.defineProperty(o.prototype, '__lookupSetter__', {
                value: function value(key) {
                    var d,
                        p = this;
                    while (p && (d = o.getOwnPropertyDescriptor(p, key)) === undefined) {
                        p = o.getPrototypeOf(this);
                    }
                    return d ? d.set : undefined;
                }
            });
            // Immutable Prototype Exotic Objects
            // https://github.com/tc39/ecma262/issues/272
            o.seal(o.prototype);
        });
    } catch (ignore) {
        // Ignored
    }
}

var HookFnName = '$RealmEvaluatorIIFE$';

// TODO: we really need to find a way to do the right thing here.
// wrapping the source with `with` statements create a new lexical scope,
// that can prevent access to the globals in the sandbox by shadowing them
// with the properties of the windshield.
// additionally, strict mode is enforced to prevent leaking
// global variables into the sandbox.
function addLexicalScopesToSource(sourceText) {
    /**
     * We use two `with` statements, the outer one uses `argments[1]`, which is the
     * `sandbox.windshield`, while the inner `with` statement uses `argument[0]`,
     * which is the realm's global object. Aside from that, the `this` value in
     * sourceText will correspond to `argument[0]` as well.
     */
    return '\n        function ' + HookFnName + '() {\n            with (arguments[1]) {\n                with(arguments[0]) {\n                    return (function(){\n                        "use strict";\n                        return eval(`' + sourceText + '`);\n                    }).call(arguments[0]);\n                }\n            }\n        }\n    ';
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

function evaluate(sourceText, realm, sandbox) {
    if (!sourceText) {
        return undefined;
    }
    sourceText = addLexicalScopesToSource(sourceText);
    var fn = evalAndReturn(sourceText, sandbox);
    return fn.apply(undefined, [realm.global, sandbox.windshield]);
}

function getStdLib(sandbox) {
    var _ = sandbox.confinedWindow;

    return {
        Array: { value: _.Array },
        ArrayBuffer: { value: _.ArrayBuffer },
        Boolean: { value: _.Boolean },
        DataView: { value: _.DataView },
        Date: { value: _.Date },
        decodeURI: { value: _.decodeURI },
        decodeURIComponent: { value: _.decodeURIComponent },
        encodeURI: { value: _.encodeURI },
        encodeURIComponent: { value: _.encodeURIComponent },
        Error: { value: _.Error },
        eval: { value: _.eval },
        EvalError: { value: _.EvalError },
        Float32Array: { value: _.Float32Array },
        Float64Array: { value: _.Float64Array },
        Function: { value: _.Function },
        Int8Array: { value: _.Int8Array },
        Int16Array: { value: _.Int16Array },
        Int32Array: { value: _.Int32Array },
        isFinite: { value: _.isFinite },
        isNaN: { value: _.isNaN },
        JSON: { value: _.JSON },
        Map: { value: _.Map },
        Math: { value: _.Math },
        Number: { value: _.Number },
        Object: { value: _.Object },
        parseFloat: { value: _.parseFloat },
        parseInt: { value: _.parseInt },
        Promise: { value: _.Promise },
        Proxy: { value: _.Proxy },
        RangeError: { value: _.RangeError },
        ReferenceError: { value: _.ReferenceError },
        Reflect: { value: _.Reflect },
        RegExp: { value: _.RegExp },
        Set: { value: _.Set },
        String: { value: _.String },
        Symbol: { value: _.Symbol },
        SyntaxError: { value: _.SyntaxError },
        TypeError: { value: _.TypeError },
        Uint8Array: { value: _.Uint8Array },
        Uint8ClampedArray: { value: _.Uint8ClampedArray },
        Uint16Array: { value: _.Uint16Array },
        Uint32Array: { value: _.Uint32Array },
        URIError: { value: _.URIError },
        WeakMap: { value: _.WeakMap },
        WeakSet: { value: _.WeakSet }

    };
}

function getIntrinsics(sandbox) {
    var _ = sandbox.confinedWindow;

    return {
        // %Array%
        "Array": _.Array,
        // %ArrayBuffer%
        "ArrayBuffer": _.ArrayBuffer,
        // %ArrayBufferPrototype%
        "ArrayBufferPrototype": _.ArrayBuffer.prototype,
        // %ArrayIteratorPrototype%
        "ArrayIteratorPrototype": undefined,
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
        "eval": _.eval,
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
        "Function": _.Function,
        // %FunctionPrototype%
        "FunctionPrototype": _.Function.prototype,
        // %Generator%
        "Generator": undefined,
        // %GeneratorFunction%
        "GeneratorFunction": undefined,
        // %GeneratorPrototype%
        "GeneratorPrototype": undefined,
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
        "IteratorPrototype": undefined,
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
        "StringIteratorPrototype": undefined,
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
        "WeakSetPrototype": _.WeakSet.prototype

    };
}

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var RealmToSandbox = new WeakMap();

function getSandbox(realm) {
    var sandbox = RealmToSandbox.get(realm);
    if (!sandbox) {
        throw new Error("Invalid realm object.");
    }
    return sandbox;
}

var Realm = function () {
    function Realm() {
        classCallCheck(this, Realm);

        var sandbox = createSandbox();
        sanitize(sandbox);
        // TODO: assert that RealmToSandbox does not have `this` entry
        RealmToSandbox.set(this, sandbox);
        var confinedWindow = sandbox.confinedWindow;

        this.global = confinedWindow.Object.create(null);
        this.init();
    }

    createClass(Realm, [{
        key: "init",
        value: function init() {
            Object.defineProperties(this.global, this.stdlib);
        }
    }, {
        key: "eval",
        value: function _eval(sourceText) {
            var sandbox = getSandbox(this);
            return evaluate(sourceText, this, sandbox);
        }
    }, {
        key: "stdlib",
        get: function get() {
            var sandbox = getSandbox(this);
            return getStdLib(sandbox);
        }
    }, {
        key: "intrinsics",
        get: function get() {
            var sandbox = getSandbox(this);
            return getIntrinsics(sandbox);
        }
    }]);
    return Realm;
}();

return Realm;

})));
//# sourceMappingURL=realm-shim.js.map
