# ECMAScript spec proposal for Realms API

## Status

### Current Stage

This proposal is at stage 2 of [the TC39 Process](https://tc39.github.io/process-document/).

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

## Intuitions

* sandbox
* iframe without DOM
* principled version of Node's `'vm'` module
* sync Worker

## Why we need realms?

Realms allow virtualization of the language itself.

Various examples of why Realms are needed:

  * Web-based IDEs or any kind of 3rd party code execution uses same origin evaluation.
  * Fiddler & Co.
  * JSPerf & Co.
  * Test frameworks (in-browser tests, but also in node using `vm`).
  * testing/mocking (e.g., jsdom)
  * Most plugin mechanism for the web (e.g., spreadsheet functions).
  * Sandboxing (e.g.: Oasis Project)
  * Server side rendering (to avoid collision and data leakage)
  * in-browser code editors
  * in-browser transpilation

Note: the majority of the examples above will require synchronous operations to be supported, which makes it almost impossible to use Workers & co., or any other isolation mechanism in browsers and nodejs today.

## Examples

### Example: simple realm

```js
let g = window; // outer global
let r = new Realm(); // root realm

let f = r.globalThis.eval("(function() { return 17 })");

f() === 17 // true

Reflect.getPrototypeOf(f) === g.Function.prototype // false
Reflect.getPrototypeOf(f) === r.globalThis.Function.prototype // true
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

### Example: Importing Module

```js
let r = new Realm();
const { x } = await r.import('/path/to/foo.js');
```

In this example, the new realm will fetch, and evaluate the module, and extract the `x` named export from that module namespace. `Realm.prototype.import` is equivalent to the dynamic import syntax (e.g.: `const { x } = await import('/path/to/foo.js');` from within the realm. In some cases, evaluation will not be available (e.g.: in browsers, CSP might block unsafe-eval), while importing from module is still possible.

## API (TypeScript Format)

```ts
declare class Realm {
    constructor();
    readonly globalThis: typeof globalThis;
    import(specifier: string): Promise<Namespace>;
}
```

## Presentations

* [TC39 Incubator Call May 26th 2020](https://docs.google.com/presentation/d/1FMQB8fu059zSJOtC3uOCbBCYiXAcvHojxzcDjoVQYAo/edit)
* [TC39 Feb 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1umg2Kw18IlQyzrWwaQCAkeZ6xLTGZPPB6MtnI2LFzWE/edit)
* [TC39 May 2018 - Stage 2 Request](https://docs.google.com/presentation/d/1blHLQuB3B2eBpt_FbtLgqhT6Zdwi8YAv6xhxPNA_j0A/edit) (archived)

## Contributing

### Updating the spec text for this proposal

The source for the spec text is located in [spec.html](spec.html) and it is written in
[ecmarkup](https://github.com/bterlson/ecmarkup) language.

When modifying the spec text, you should be able to build the HTML in
`dist/index.html` by using the following command:

```bash
npm install
npm run build
open dist/index.html
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
