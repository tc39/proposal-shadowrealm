# Realm Shim [![License][license-image]][license-url] [![Build Status][travis-svg]][travis-url]

This folder contains a shim implementation of the Realm API specified in this repo.

## Limitations

The current implementation has 3 main limitations:

* All code evaluated inside a Realm runs in strict mode.
* Direct eval is not supported.
* `let`, global function declarations and any other feature that relies on new bindings in global contour are not preserved between difference invocations of eval, instead we create a new contour everytime.

## Building the Shim

```bash
git clone https://github.com/tc39/proposal-realms.git
cd proposal-realms
npm install
npm run build-shim
```

This will install the necessary dependencies and build the shim locally.

## Playground

To open the playground example in your default browser.

```bash
open shim/examples/simple.html
```

## Usage

To use the shim in a webpage:
```html
  <script src="../dist/realm-shim.min.js"></script>
  <script>
    const r = new Realm();
    [...]
  </script>
```

To use the shim with node:
```js
  const Realm = require('./realm-shim.min.js');
  const r = new Realm();
  [...]
```

To can also use es6 modules on node via package `esm`. To do that, launch node with esm via the "require" option:

```bash
npm install esm
node -r esm main.js
```

And import the realm module in your code:

```js
  import Realm from './shim/src/realm';
  const r = new Realm();
  [...]
```

## Examples

### Example 1: Root Realm

To create a root realm with a new global and a fresh set of intrinsics:

```js
const r = new Realm(); // root realm
r.global === this; // false
r.global.JSON === JSON; // false
```

### Example 2: Realm Compartment

To create a realm compartment with a new global and inherit the intrinsics from another realm:

```js
const r1 = new Realm(); // root realm
const r2 = new r1.global.Realm({ intrinsics: 'inherit' }); // realm compartment
r1.global === r2.global; // false
r1.global.JSON === r2.global.JSON; // true
```

### Example 3: Realm Compartment from current Realm

To create a realm compartment with a new global and inherit the intrinsics from the current execution context:

```js
const r = new Realm({ intrinsics: 'inherit' }); // realm compartment
r.global === this; // false
r.global.JSON === JSON; // true
```

### Example 4: Frozen realm

To create a frozen realm:

```js
const r = new Realm(); // root realm
r.freeze();
'use strict'; // disable silent errors
r.evaluate('[].__proto__.slice = function(){}'); // TypeError: Cannot assign to read only property 'parse'
```

### Example 5: Frozen realm from current Realm (careful)

To create a frozen realm compartment from the current execution context (which will also become frozen):

```js
const r = new Realm({ intrinsics: 'inherit' }); // realm compartment
r.freeze()
'use strict'; // disable silent errors
[].__proto__.slice = function(){}; // TypeError: Cannot assign to read only property 'slice'
```

[travis-svg]: https://travis-ci.com/tc39/proposal-realms.svg?branch=master
[travis-url]: https://travis-ci.com/tc39/proposal-realms
[license-image]: https://img.shields.io/badge/License-Apache%202.0-blue.svg
[license-url]: LICENSE

