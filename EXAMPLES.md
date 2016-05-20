# Realm API usage

## iframes vs realms

If you're using anonymous iframes today to "evaluate" javascript code in a different realm, you can replace it with a new Realm, as a more performant option, e.g.:

```js
const globalOne = window;
let iframe = document.createElement('iframe');
document.body.appendChild(iframe);
const globalTwo = iframe.contentWindow;
```

will become:

```js
const globalOne = window;
const globalTwo = new Realm();
```

### Indirect evaluation

This operation should be equivalent, in both scenarios:

```js
globalOne.eval('1 + 2'); // yield 3
globalTwo.eval('1 + 2'); // yield 3
```

### Direct evaluation

This operation should be equivalent, in both scenarios:

```js
globalOne.eval('eval("1 + 2")'); // yield 3
globalTwo.eval('eval("1 + 2")'); // yield 3
```

### Identity Discontinuity

Considering that you're creating a brand new realm, with its brand new global variable,
the identity discontinuity is still present, just like in the iframe example:

```js
let a1 = globalOne.eval('[1,2,3]');
let a2 = globalTwo.eval('[1,2,3]');
a1.prototype === a2.prototype; // yield false
a1 instanceof globalTwo.Array; // yield false
a2 instanceof globalOne.Array; // yield false
```

_Note: There is not solution for this with iframes, the only possible partial-solution is to use `with` statement which has some performance implications. With the Realm API, you will have more flexibility to avoid this issue._

### Non-intrinsics

If you attempt to evaluate code that uses something other than EcmaScript intrinsics,
the code will fail to evaluate in the realm without the proper configuration, e.g.:

```js
globalOne.eval('console.log(1)'); // yield a log message: "1"
globalTwo.eval('console.log(1)'); // throw an error: console is undefined
```

To solve this, you can set up the global of the realm to allow use of non-intrinsics, e.g.:

```js
globalTwo.console = globalOne.console;
```

Note: keep in mind that this will provide authority for code in the realm to walk its
way up into the globalOne object by using the prototype chain of the new global called
`console`, e.g.:

```js
globalTwo.eval('console.log.constructor("return this")()') === globalOne; // yield true
```

This can be prevented by:

* CSP `unsafe-eval` mechanical switch
* Guaranteeing that all code evaluated in the realm is running in `"strict mode"`.
* Providing a shim for `console` instead of providing access to the real one.

## node's vm objects vs realms

If you're using node's `vm` module today to "evaluate" javascript code in a different realm, you can replace it with a new Realm, e.g.:

```js
const vm = require('vm');
const script = new vm.Script('this');
const globalOne = global;
const globalTwo = script.runInContext(new vm.createContext());
```

will become:

```js
const globalOne = global;
const globalTwo = new Realm();
```

_Note: these two are equivalent in functionality._
