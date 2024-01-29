# ECMAScript spec proposal for ShadowRealm API

## <a name='Status'></a>Status

- [Explainer](explainer.md).
- [HTML Rendered Spec](https://tc39.es/proposal-shadowrealm/).
- Currently at [Stage 2](https://tc39.es/process-document/).
- [Code of Conduct](https://tc39.es/code-of-conduct/)

### <a name='Champions'></a>Champions

 * @dherman
 * @caridy
 * @erights
 * @leobalter
 * @rwaldron
 * @legendecas

## Index

* [What are ShadowRealms?](#WhatareRealms)
* [API (TypeScript Format)](#APITypeScriptFormat)
* [Presentations](#Presentations)
* [History](#History)
* [Contributing](#Contributing)
	* [Updating the spec text for this proposal](#Updatingthespectextforthisproposal)

## <a name='WhatareRealms'></a>What are ShadowRealms?

ShadowRealms are a distinct global environment, with its own global object containing its own intrinsics and built-ins (standard objects that are not bound to global variables, like the initial value of Object.prototype).

See more at the [explainer](explainer.md) document.

## <a name='APITypeScriptFormat'></a>API (TypeScript Format)

```ts
declare class ShadowRealm {
    constructor();
    importValue(specifier: string, bindingName: string): Promise<PrimitiveValueOrCallable>;
    evaluate(sourceText: string): PrimitiveValueOrCallable;
}
```

See some examples [in the Explainer file](explainer.md).

## <a name='Presentations'></a>Presentations

* [TC39 Meeting, July 12th 2021 - Stage 3 Request](https://docs.google.com/presentation/d/1MgrUnQH25gDVosKnH10n9n9msvrLkdaHI0taQgOWRcs)
* [TC39 Meeting, May 25th 2021 - Stage 2 Update](https://docs.google.com/presentation/d/1c-7nsjAUkdWYie5n1NlEr7_FxMXHyXjRFzsReLTm8S8)
* [TC39 Meeting, April 2021 - Introduction of Callable Boundary Reealms](https://docs.google.com/presentation/d/1VbfgfZgNCcWhPu-8JWd27hrL9jEfakWPSWPcJLa3SIw)
* [TC39 Meeting, January 2021 - Realms update from Chrome's position on the previous API](https://github.com/tc39/notes/blob/master/meetings/2021-01/jan-26.md#realms-update)
* [TC39 Meeting, November 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1mKdez8FMbJ4QQ2KsOCMXOKVW6QoUnrNQf2cwsLy0MyI)
* [TC39 Meeting, June 4th 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1TfVtfolisUrxAPflzm8wIhBBv_7ij3KLeqkfpdvpFiQ/edit?ts=5ed5d3e7)
* [TC39 Incubator Call May 26th 2020](https://docs.google.com/presentation/d/1FMQB8fu059zSJOtC3uOCbBCYiXAcvHojxzcDjoVQYAo/edit)
* [TC39 Feb 2020 - Stage 2 Update](https://docs.google.com/presentation/d/1umg2Kw18IlQyzrWwaQCAkeZ6xLTGZPPB6MtnI2LFzWE/edit)
* [TC39 May 2018 - Stage 2 Request](https://docs.google.com/presentation/d/1blHLQuB3B2eBpt_FbtLgqhT6Zdwi8YAv6xhxPNA_j0A/edit) (archived)

## <a name='History'></a>History

* we moved on from the exposed globalThis model to a lean isolated realms API (see #289 and #291)
* we worked on this during ES2015 time frame, so never went through stages process ([ES6 Realm Objects proto-spec.pdf](https://github.com/tc39/proposal-shadowrealm/files/717415/ES6.Realm.Objects.proto-spec.pdf))
* got punted to later (rightly so!)
* goal of this proposal: resume work on this, reassert committee interest via advancing to stage 2
* original idea from @dherman: [What are Realms?](https://gist.github.com/dherman/7568885)

## <a name='Contributing'></a>Contributing

### <a name='Updatingthespectextforthisproposal'></a>Updating the spec text for this proposal

The source for the spec text is located in [spec.html](spec.html) and it is written in
[ecmarkup](https://github.com/bterlson/ecmarkup) language.

When modifying the spec text, you should be able to build the HTML version by using the following command:

```bash
npm install
npm run build
open dist/index.html
```

Alternatively, you can use `npm run watch`.
