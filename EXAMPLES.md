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
