# ECMAScript spec proposal for Realms API

## Index

- [Status](#status)
- [Spec Text](#spec-text)
- [History](#history)
- [What Are Realms?](#what-are-realms)
- [API](#api-typescript-format)
- [Examples](#examples)
- [Presentations](#presentations)
- [Contributing](#contributing)

### Other documents:

- [Code of Conduct](https://tc39.es/code-of-conduct/)
- [Explainer](explainer.md)
- [Examples](EXAMPLES.md)

## Status

### Current Stage

This proposal is at stage 2 of [the TC39 Process](https://tc39.es/process-document/).

### Champions

 * @dherman
 * @caridy
 * @erights
 * @leobalter

### Spec Text

You can view the spec rendered as [HTML](https://tc39.es/proposal-realms/).

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

```js
// this is the root realm
var x = 39;
const realm = new Realm();

// globals from the root/parent realm are not leaked to the nested realms
realm.globalThis.x; // undefined

// evaluation occurs within the nested realm
realm.globalThis.eval("var x = 42");

// global names can be regularly observed in the realm's globalThis
realm.globalThis.x; // 42

// global values are not leaked to the parent realms
x; // 39

// built-ins configurability are not different
delete realm.globalThis.Math;

// realms can dynamic import module that will execute within it's own
// environment. Imports can be observed from the parent realm.
realm.import('./file.js').then(ns => ns.execCustomCode());
```

See some other examples [here](EXAMPLES.md).

## Presentations

* [TC39 Meeting, June 4th 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1TfVtfolisUrxAPflzm8wIhBBv_7ij3KLeqkfpdvpFiQ/edit?ts=5ed5d3e7)
* [TC39 Incubator Call May 26th 2020](https://docs.google.com/presentation/d/1FMQB8fu059zSJOtC3uOCbBCYiXAcvHojxzcDjoVQYAo/edit)
* [TC39 Feb 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1umg2Kw18IlQyzrWwaQCAkeZ6xLTGZPPB6MtnI2LFzWE/edit)
* [TC39 May 2018 - Stage 2 Request](https://docs.google.com/presentation/d/1blHLQuB3B2eBpt_FbtLgqhT6Zdwi8YAv6xhxPNA_j0A/edit) (archived)

## Contributing

### Updating the spec text for this proposal

The source for the spec text is located in [spec.html](spec.html) and it is written in
[ecmarkup](https://github.com/bterlson/ecmarkup) language.

When modifying the spec text, you should be able to build the HTML version by using the following command:

```bash
npm install
npm run build
open dist/index.html
```

Alternatively, you can use `npm run watch`.
