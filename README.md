# ECMAScript spec proposal for Realms API

## Status

### Current Stage

This proposal is at stage 2 of [the TC39 Process](https://tc39.github.io/process-document/).

### Champions

 * @dherman
 * @caridy
 * @erights

### Spec Text

You can view the spec rendered as [HTML](https://rawgit.com/tc39/proposal-realms/master/index.html).

### Shim/Polyfill
[![Build Status][travis-svg]][travis-url]
[![Coverage Status][coveralls-svg]][coveralls-url]
[![dependency status][deps-svg]][deps-url]
[![dev dependency status][dev-deps-svg]][dev-deps-url]
[![License][license-image]][license-url]

A shim implementation of the Realm API can be found under the [shim folder](shim/).

You can play around with the current version of the shim with the [Realm playground](https://rawgit.com/tc39/proposal-realms/master/shim/examples/simple.html).

# Realms

## History

* worked on this during ES2015 time frame, so never went through stages process
* got punted to later (rightly so!)
* goal of this proposal: resume work on this, reassert committee interest via advancing to stage 2
* original idea from @dherman: [What are Realms?](https://gist.github.com/dherman/7568885)

## Intuitions

* sandbox
* iframe without DOM
* principled version of Node's `'vm'` module
* sync Worker

## Use cases

* security isolation (with synchronous but coarse-grained communication channel)
* plugins (e.g., spreadsheet functions)
* in-browser code editors
* server-side rendering
* testing/mocking (e.g., jsdom)
* in-browser transpilation

## Examples

### Example: simple realm

```js
let g = window; // outer global
let r = new Realm(); // root realm

let f = r.evaluate("(function() { return 17 })");

f() === 17 // true

Reflect.getPrototypeOf(f) === g.Function.prototype // false
Reflect.getPrototypeOf(f) === r.global.Function.prototype // true
```

### Example: simple compartment

```js
let g = window; // outer global
let r1 = new Realm(); // root realm
let r2 = new r1.global.Realm({ intrinsics: "inherit" }); // realm compartment

let f = r1.evaluate("(function() { return 17 })");

f() === 17 // true

Reflect.getPrototypeOf(f) === g.Function.prototype // false
Reflect.getPrototypeOf(f) === r1.global.Function.prototype // true
Reflect.getPrototypeOf(f) === r2.global.Function.prototype // true
```
### Example: simple subclass

```js
class EmptyRealm extends Realm {
  constructor(...args) { super(...args); }
  init() { /* do nothing */ }
}
```

### Example: DOM mocking

```js
class FakeWindow extends Realm {
  init() {
    super.init(); // install the standard primordials
    let global = this.global;

    global.document = new FakeDocument(...);
    global.alert = new Proxy(fakeAlert, { ... });
    ...
  }
}
```

### Example: parameterized evaluator

#### Transform Trap

The `transform` trap provides a way to preprocess any sourceText value before it is evaluated, and it applies to direct and indirect evaluation alike. E.g.:

```js
const r = new Realm({
  transform(sourceText) {
    return remapXToY(sourceText);
  },
});
r.global.y = 1;
const a = r.evaluate(`let x = 2; eval("x")`);      // yields 1 after remapping `x` to the global `y`.
const b = r.evaluate(`let x = 3; (0, eval)("x")`); // yields 1 after remapping `x` to the global `y`.
```

For mode details about how to implement a JS dialects with Realms, check the following gist:

 * https://gist.github.com/dherman/9146568 (outdated API, but the same principle applies).

### Example: controlling direct evaluation

The `isDirectEval` trap provides a way to control when certain invocation to an `eval` identifier qualifies as direct eval. This is important if you plan to replace the `eval` intrinsic to provide your own evaluation mechanism:

```js
const r = new Realm({
  isDirectEval(func) {
    return func === r.customEval;
  },
});
function customEval(sourceText) {
  return compile(sourceText);
}
r.global.eval = customEval; // providing a custom evaluation mechanism
const source = `
  let x = 1;
  (function foo() {
    let x = 2;
    eval('x');      // yields 2 if `compile` doesn't alter the code
    (0,eval)('x');  // yields 1 if `compile` doesn't alter the code
  })();
`;
r.evaluate(source);
```

#### Import Trap

The import trap has been removed for stage 2. We might bring it back at some point.

## Contributing

### Updating the spec text for this proposal

The source for the spec text is located in [spec/index.emu](spec/index.emu) and it is written in
[ecmarkup](https://github.com/bterlson/ecmarkup) language.

When modifying the spec text, you should be able to build the HTML version in
`index.html` by using the following command:

```bash
npm install
npm run build
open index.html
```

Alternative, you can use `npm run watch`.

[travis-svg]: https://travis-ci.com/tc39/proposal-realms.svg?branch=master
[travis-url]: https://travis-ci.com/tc39/proposal-realms
[coveralls-svg]: https://coveralls.io/repos/github/tc39/proposal-realms/badge.svg
[coveralls-url]: https://coveralls.io/github/tc39/proposal-realms
[deps-svg]: https://david-dm.org/tc39/proposal-realms.svg
[deps-url]: https://david-dm.org/tc39/proposal-realms
[dev-deps-svg]: https://david-dm.org/tc39/proposal-realms/dev-status.svg
[dev-deps-url]: https://david-dm.org/tc39/proposal-realms?type=dev
[license-image]: https://img.shields.io/badge/License-Apache%202.0-blue.svg
[license-url]: shim/LICENSE
