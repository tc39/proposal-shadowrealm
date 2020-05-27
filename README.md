# ECMAScript spec proposal for Realms API

## Status

### Current Stage

This proposal is at stage 2 of [the TC39 Process](https://tc39.es/process-document/).

### Champions

 * @dherman
 * @caridy
 * @erights

### Spec Text

You can view the spec rendered as [HTML](https://tc39.es/proposal-realms/).

# Realms

## History

* we worked on this during ES2015 time frame, so never went through stages process ([ES6 Realm Objects proto-spec.pdf](https://github.com/tc39/proposal-realms/files/717415/ES6.Realm.Objects.proto-spec.pdf))
* got punted to later (rightly so!)
* goal of this proposal: resume work on this, reassert committee interest via advancing to stage 2
* original idea from @dherman: [What are Realms?](https://gist.github.com/dherman/7568885)

## What are realms?

Realms are a distinct global environment, with its own global object containing its own intrinsics and built-ins (standard objects that are not bound to global variables, like the initial value of Object.prototype).

See more at the [explainer](explainer.md) document.

## API (TypeScript Format)

```ts
declare class Realm {
    constructor();
    readonly globalThis: typeof globalThis;
    import(specifier: string): Promise<Namespace>;
}
```

## Examples

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

  let Arr = test("Array"); // {writable: true, enumerable: false, configurable: true, value: ƒ}

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

## Presentations

* [TC39 Incubator Call May 26th 2020](https://docs.google.com/presentation/d/1FMQB8fu059zSJOtC3uOCbBCYiXAcvHojxzcDjoVQYAo/edit)
* [TC39 Feb 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1umg2Kw18IlQyzrWwaQCAkeZ6xLTGZPPB6MtnI2LFzWE/edit)
* [TC39 May 2018 - Stage 2 Request](https://docs.google.com/presentation/d/1blHLQuB3B2eBpt_FbtLgqhT6Zdwi8YAv6xhxPNA_j0A/edit) (archived)

## Contributing

### Updating the spec text for this proposal

The source for the spec text is located in [spec.html](spec.emu) and it is written in
[ecmarkup](https://github.com/bterlson/ecmarkup) language.

When modifying the spec text, you should be able to build the HTML version by using the following command:

```bash
npm install
npm run build
open dist/index.html
```

Alternatively, you can use `npm run watch`.

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
