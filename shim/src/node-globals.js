(function() {
  const ProxiesMap = new WeakMap();

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

  /*
  const allTraps = Object.freeze([
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
  ]);
  */

  /* Handler.prototype.has is NOT defined, because that would just return
   * Reflect.has(...).  So we'll take advantage of the fall-through to Reflect.
   *
   * Similarly, Handler.prototype.ownKeys is not defined.
   */

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
      ProxiesMap.set(gValue, map);
    }

    map[pSymbol] = pValue;
    ProxiesMap.set(pValue, map);
    return map;
  };
  
  Handler.prototype.getProxyForValue = function(target) {
    {
      if (target === null)
        return target;
      let type = typeof target;
      if ((type != "function") && (type != "object"))
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
    return this.getProxyForValue(Reflect.getPrototypeOf(target));
  };

  Handler.prototype.getOwnPropertyDescriptor = function(target, propName) {
    let rv = Reflect.getOwnPropertyDescriptor(target, propName);
    if (rv && rv.configurable)
      ["value", "get", "set"].forEach((name) => {
        if (name in rv)
          rv[name] = this.getProxyForValue(rv[name]);
      }, this);
    return rv;
  };

  Handler.prototype.get = function(target, propName) {
    return this.getProxyForValue(Reflect.get(target, propName));
  };

  Handler.prototype.apply = function(target, thisArg, argumentsList) {
    /* In a normal membrane, we would want to convert thisArg and argumentsList
     * into the original values.  In this membrane, we're dealing with a
     * protected set of the global's properties, so it's best to leave thisArg
     * and argumentsList wrapped, in case the target wants to modify the
     * arguments.
     */
    return this.getProxyForValue(
      Reflect.apply(target, thisArg, argumentsList)
    );
  };

  Handler.prototype.construct = function(target, argumentsList, newTarget) {
    // See comment for Handler.prototype.apply.
    return this.getProxyForValue(
      Reflect.construct(target, argumentsList, newTarget)
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
