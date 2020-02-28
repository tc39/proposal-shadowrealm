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

A shim implementation of the Realm API can be found at [https://github.com/Agoric/realms-shim](https://github.com/Agoric/realms-shim), notice that this library is now deprecated.

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

## API (TypeScript Format)

```ts
declare class Realm {
    constructor();
    readonly globalThis: typeof globalThis;
    evaluate(sourceText: string): any;
}
```

## Presentations

* [TC39 Feb 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1umg2Kw18IlQyzrWwaQCAkeZ6xLTGZPPB6MtnI2LFzWE/edit)
* [TC39 May 2018 - Stage 2 Request](https://docs.google.com/presentation/d/1blHLQuB3B2eBpt_FbtLgqhT6Zdwi8YAv6xhxPNA_j0A/edit) (archived)

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
