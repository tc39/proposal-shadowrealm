(function() {
  "use strict";
  const Protected = new Map();
  {
    // Based on Node 6.5.0
    Protected.set(global, Object.freeze([
      'DataView',
      'encodeURI',
      'Date',
      'EvalError',
      'parseFloat',
      'Set',
      'RangeError',
      'WeakMap',
      'Uint8Array',
      'Proxy',
      'Array',
      'Int32Array',
      'Reflect',
      'Int16Array',
      'Function',
      'Boolean',
      'Uint8ClampedArray',
      'unescape',
      'Float64Array',
      'ReferenceError',
      'TypeError',
      'undefined',
      'encodeURIComponent',
      'Symbol',
      'Uint16Array',
      'decodeURIComponent',
      'Promise',
      'Math',
      'eval',
      'WeakSet',
      'Infinity',
      'isFinite',
      'decodeURI',
      'Error',
      'Intl',
      'JSON',
      'Uint32Array',
      'String',
      'Number',
      'SyntaxError',
      'Int8Array',
      'isNaN',
      'ArrayBuffer',
      'RegExp',
      'Map',
      'NaN',
      'URIError',
      'parseInt',
      'Float32Array',
      'Object',
      'escape',
      'DTRACE_NET_SERVER_CONNECTION',
      'DTRACE_NET_STREAM_END',
      'DTRACE_HTTP_SERVER_REQUEST',
      'DTRACE_HTTP_SERVER_RESPONSE',
      'DTRACE_HTTP_CLIENT_REQUEST',
      'DTRACE_HTTP_CLIENT_RESPONSE',
      'global',
      'process',
      /* Deprecated
      'GLOBAL',
      'root',
      */
      'Buffer',
      'clearImmediate',
      'clearInterval',
      'clearTimeout',
      'setImmediate',
      'setInterval',
      'setTimeout',
      'console',
      'module',
      'require',
      'assert',
      'buffer',
      'child_process',
      'cluster',
      'crypto',
      'dgram',
      'dns',
      'domain',
      'events',
      'fs',
      'http',
      'https',
      'net',
      'os',
      'path',
      'punycode',
      'querystring',
      'readline',
      'repl',
      'stream',
      'string_decoder',
      'tls',
      'tty',
      'url',
      'util',
      'v8',
      'vm',
      'zlib',
      '_'
    ]));

    Protected.set(Reflect, Object.freeze([
      "getPrototypeOf",
      "setPrototypeOf",
      "isExtensible",
      "preventExtensions",
      "getOwnPropertyDescriptor",
      "defineProperty",
      "has",
      "get",
      "set",
      "deleteProperty",
      "ownKeys",
      "apply",
      "construct"
    ]));
  }

  // Define a frozen copy of Reflect.
  const _Reflect = {};
  Protected.get(Reflect).forEach(function(name) {
    _Reflect[name] = Reflect[name].bind(Reflect);
  });
  Object.freeze(_Reflect);

  const ProxiesMap = new WeakMap();
  const unwrappedSymbol = Symbol("unwrapped");

  // Register each item that should reachable from a clean global in the ProxiesMap.
  {
    let knownSet = [];

    let gRegister = function(item) {
      if (item !== null) {
        let type = typeof item;
        if ((type !== "function") && (type !== "object")) {
          // item is a primitive, and cannot be added to the weak set
          return;
        }
      }

      if (!ProxiesMap.has(item)) {
        let map = {};
        map[unwrappedSymbol] = item;
        try {
          ProxiesMap.set(item, {});
        }
        catch (e) {
          // Just let it go.
          return;
        }
        knownSet.push(item);
      }
    };

    // This takes care of the most protected objects:  global, Reflect.
    Protected.forEach(gRegister);

    // This takes care of anything reachable directly from the most protected objects.
    Protected.forEach(function(value, key) {
      value.forEach(function(name) {
        gRegister(key[name]);
      });
    });

    // This takes care of anything reachable indirectly from the most protected objects.
    for (let i = Protected.size; i < knownSet.length; i++) {
      let obj = knownSet[i];
      if (ProxiesMap.has(obj))
        continue;
      let keys = _Reflect.ownKeys(obj);
      keys.forEach(function(name) {
        try {
          gRegister(obj[name]);
        }
        catch (e) {
          // Phooey.
        }
      });
    }
  }

  const revokeAll = function() {
    this.__revokeFunctions__.forEach((revocable) => { revocable(); });
  };

  const Handler = function(symbol) {
    this.symbol = symbol;
    this.revoke = revokeAll.bind(this);
    this.__revokeFunctions__ = new Set();
    Object.freeze(this);
  };
  const returnFalse = function() { return false; };

  // Nothing is allowed to modify the global or any descendant value of it.
  Handler.prototype.setPrototypeOf = returnFalse;
  Handler.prototype.isExtensible   = returnFalse;
  Handler.prototype.preventExtensions = function() { return true; };
  Handler.prototype.defineProperty = returnFalse;
  Handler.prototype.set = returnFalse;
  Handler.prototype.deleteProperty = returnFalse;

  const register = function(gValue, pValue, pSymbol) {
    let map = ProxiesMap.get(gValue);
    if (!map) {
      map = {};
      map[unwrappedSymbol] = gValue; // is this desirable?
      ProxiesMap.set(gValue, map);
    }

    map[pSymbol] = pValue;
    ProxiesMap.set(pValue, map);
    return map;
  };
  
  Handler.prototype.getProxyForValue = function(target) {
    if (target === null) {
      return target;
    }
    {
      let type = typeof target;
      if ((type !== "function") && (type !== "object"))
        return target;
    }

    let mapping = ProxiesMap.get(target);
    if (!mapping || !mapping[this.symbol]) {
      let {proxy, revoke} = Proxy.revocable(target, this);
      this.__revokeFunctions__.add(revoke);
      mapping = register(target, proxy, this.symbol);
    }

    return mapping[this.symbol];
  };

  Handler.prototype.getPrototypeOf = function(target) {
    return this.getProxyForValue(_Reflect.getPrototypeOf(target));
  };

  Handler.prototype.getOwnPropertyDescriptor = function(target, propName) {
    if (Protected.has(target) && !Protected.get(target).includes(propName))
      return undefined;

    let rv = _Reflect.getOwnPropertyDescriptor(target, propName);
    if (rv && rv.configurable)
      ["value", "get", "set"].forEach((name) => {
        if (name in rv)
          rv[name] = this.getProxyForValue(rv[name]);
      }, this);
    return rv;
  };

  Handler.prototype.has = function(target, propName) {
    if (Protected.has(target) && !Protected.get(target).includes(propName))
      return false;

    return _Reflect.has(target, propName);
  };

  Handler.prototype.get = function(target, propName) {
    if (Protected.has(target) && !Protected.get(target).includes(propName))
      return undefined;
    return this.getProxyForValue(_Reflect.get(target, propName));
  };

  Handler.prototype.ownKeys = function(target) {
    return Protected.get(target) || _Reflect.ownKeys(target);
  };

  Handler.prototype.apply = function(target, thisArg, argumentsList) {
    if (Protected.has(target) && !Protected.get(target).includes(propName))
      throw new Error("Protected objects are not callable!  How did this happen?");

    /* In a normal membrane, we would want to convert thisArg and argumentsList
     * into the original values.  In this membrane, we're dealing with a
     * protected set of the global's properties, so it's best to leave thisArg
     * and argumentsList wrapped, in case the target wants to modify the
     * arguments.
     */
    return this.getProxyForValue(
      _Reflect.apply(target, thisArg, argumentsList)
    );
  };

  Handler.prototype.construct = function(target, argumentsList, newTarget) {
    if (Protected.has(target) && !Protected.get(target).includes(propName))
      throw new Error("Protected objects are not callable!  How did this happen?");

    // See comment for Handler.prototype.apply.
    return this.getProxyForValue(
      _Reflect.construct(target, argumentsList, newTarget)
    );
  };

  Object.freeze(Handler.prototype);
  Object.freeze(Handler);

  exports.getGlobalProxyAndRevoke = function(symbol) {
    if (ProxiesMap.has(symbol))
      throw new Error("The global proxy for this symbol is already defined!");
    let t = typeof symbol;
    if (t !== "symbol")
      throw new Error("getGlobalProxy requires argument 0 be of type 'symbol'.");
    var handler = new Handler(symbol);
    var p = handler.getProxyForValue(global);
    return {proxy: p, revoke: handler.revoke};
  };
})();
