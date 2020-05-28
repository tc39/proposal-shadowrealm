# Realm API usage

### Example: simple realm

```js
let g = globalThis; // outer global
let r = new Realm(); // root realm

let f = r.globalThis.Function("return 17");

f() === 17 // true

Reflect.getPrototypeOf(f) === g.Function.prototype // false
Reflect.getPrototypeOf(f) === r.globalThis.Function.prototype // true
```

### Example: Importing Module

```js
let r = new Realm();
const { x } = await r.import('/path/to/foo.js');
```

In this example, the new realm will fetch, and evaluate the module, and extract the `x` named export from that module namespace. `Realm.prototype.import` is equivalent to the dynamic import syntax (e.g.: `const { x } = await import('/path/to/foo.js');` from within the realm. In some cases, evaluation will not be available (e.g.: in browsers, CSP might block unsafe-eval), while importing from module is still possible.

### Example: Virtualized contexts

Importing modules allow us to run asynchronous executions with set boundaries for access to global environment contexts.

#### main js file:

```js
globalThis.DATA = "a global value";

let r = new Realm();

// r.import is equivalent to the dynamic import expression
// It provides asynchronous execution, without creating or relying in a
// different thread or process.
r.import("./sandbox.js").then(({test}) => {
 
  // globals in this root realm are not leaked
  test("DATA"); // undefined

  let desc = test("Array"); // {writable: true, enumerable: false, configurable: true, value: ƒ}
  let Arr = desc.value;

  Arr === r.globalThis.Array; // true
  Arr === Array; // false

  // foo and bar are immediately visible as globals here.
});
```

#### sandbox.js file

```js
// DATA is not available as a global name here

// Names here are not leaked to the root realm
var foo = 42;
globalThis.bar = 39;

export function test(property) {

  // Built-ins like `Object` are included.
  return Object.getPropertyDescriptor(globalThis, property);
}
```

### Example: simple subclass

```js
class EmptyRealm extends Realm {
  constructor(...args) {
    super(...args);
    let globalThis = this.globalThis;

    // delete global descriptors:
    delete globalThis.Math;
    ...
  }
}
```

### Example: DOM mocking

```js
class FakeWindow extends Realm {
  constructor(...args) {
    super(...args);
    let globalThis = this.globalThis;

    globalThis.document = new FakeDocument(...);
    globalThis.alert = new Proxy(fakeAlert, { ... });
    ...
  }
}
```



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
const globalTwo = new Realm().globalThis;
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

_Note: There are other solutions to this problem by using proxies and membranes, which has some performance implications. It is not a goal of this proposal to solve this._

## node's vm objects vs realms

If you're using node's `vm` module today to "evaluate" javascript code in a different realm, you can replace it with a new Realm, e.g.:

```js
const vm = require('vm');
const script = new vm.Script('this');
const globalOne = globalThis;
const globalTwo = script.runInContext(new vm.createContext());
```

will become:

```js
const globalOne = globalThis;
const globalTwo = new Realm().globalThis;
```

_Note: these two are equivalent in functionality._
