# Realms Explainer

## Introduction

Realms are a distinct global environment, with its own global object containing its own intrinsics and built-ins (standard objects that are not bound to global variables, like the initial value of Object.prototype).

The Realms API allow loading 

### Intuitions

* sandbox
* virtualization / testing
* iframe without DOM
* principled version of Node's `'vm'` module
* sync Worker

### History

* we worked on this during ES2015 time frame, so never went through stages process ([ES6 Realm Objects proto-spec.pdf](https://github.com/tc39/proposal-realms/files/717415/ES6.Realm.Objects.proto-spec.pdf))
* got punted to later (rightly so!)
* original idea from @dherman: [What are Realms?](https://gist.github.com/dherman/7568885)

## Motivations

Why do developers need realms?

It's quite common for an applications to contain programs from multiple sources, whether from different teams, vendors, package managers, etc. These programs must currently contend for the global shared resources, specifically, the shared global object, and the side effect of executing those programs are often hard to observe, causing conflicts between the different programs, and potentially affecting the integrity of the app itself.

Various examples where Realms can be used to avoid this:

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

## Overview

## API

A walk-through of the Realm API with examples and explanations:

### TypeScript API

```ts
declare class Realm {
    constructor();
    readonly globalThis: typeof globalThis;
    import(specifier: string): Promise<Namespace>;
}
```

TODO: add few examples...

### Modules

In principle, the Realm proposal does not provide the controls for the module graphs. Every new Realm initializes its own module graph, while any invocation to `Realm.prototype.import()` method, or by using `import()` when evaluating code inside the realm, will populate this module graph. This is analogous to same-domain iframes, and VM in nodejs.

However, the [Compartments]() proposal plans to provide the low level hooks to control the module graph per Realm. This is one of the intersection semantics between the two proposals. Although, the biggest challenge when sharing modules across realms is the hazard of the identity discontinuity. For example, when interacting with a module evaluated in another Realm:

```js
import { x } from '/path/to/foo.js';
const d = new Date();
x(d);
```

If `x` function attempt to check `arguments[0] instanceof Date`, it yields `false` since the date object was created from a constructor from another realm.

There are some precedents on how to solve the identity discontinuity issues by using a "near membrane" via proxies. For now, providing the Realms as building block seems sufficient.

There is one important thing to keep in mind when it comes to sharing module graphs. The ESM linkage is not asynchronous. This dictates that in order to share modules between realms, those realms should share the same process, otherwise the bindings between those modules cannot work according to the language. This is another reason to support our claim that Realms should be running within the same process.

### Agents

Explain why should the realm proposal create a new Realm on the same process, why not in a different process?

WIP

### Security

This proposal does not mention "security" as one of the primary use-cases, and this is mostly for two reasons:

1. In the context of the web, "security" is mostly associated to measure duration (time), while the Realm proposal does not provide any mechanism to control or modulate that.
2. "Integrity" is far better understood in the context of Ecma-262, with strong precedents like closure, objects and private fields, to mention a few.

A very simple demonstration of how a new Realm is not a security boundary is the fact that to interact with the code evaluated inside a realm, you must likely combine the new realm's object graph with the outer realm's object graph, e.g.:

```js
let r = new Realm();
const sum = r.globalThis.eval(`(function aggregate(a, b) {
  return Object.assign({}, a, b);
})`);
const o = aggregate({ x: 1 }, { y: 2 });
```

There are two main subtleties in the example above:

1. the `aggregate` function declared inside the new realm is receiving two objects that belong to the outer realm (their `__proto__` do not correspond to the `Object.prototype` from the realm).
2. the returned value `o`, which is accessible in the outer realm (caller), is an object with a `__proto__` that do not correspond to the `Object.prototype` of the outer realm.

Nevertheless, you can virtualize the intersection between the two realms by using Proxies to preserve integrity and eliminate the identity discontinuity problems (a "near membrane" is a good example of this). This is not different to what you can achieve today via same domain iframes, or VM context in nodejs, which by no means represents any security boundary.

TODO: should we touch on overchannels vs non-overchannels here? /cc @erights

#### Combining Security and Integrity

We believe that realms can be a good complement to existing security mechanisms by providing ways to evaluate code who access different object graphs (different global objects) while maintaining the integrity of the outer realm. A concrete example of this is the Google's AMP current mechanism:

* Google News App creates multiples sub-apps that can be presented to the user.
* Each sub-app runs in a cross-domain iframe (communicating with the main app via post-message).
* Each vendor (one per app) can attempt to enhance their sub-app that display their content by executing their code in a realm that provide access to a well defined set of APIs to preserve the integrity of the sub-app.

TODO: cc @jridgewell to see if this is accurate.

There are many examples like this for the web: Google Sheets, Figma's plugins, or Salesforce's Locker Service for Web Components.

#### Security vs Integrity

There are also other more exotic cases in which measuring of time ("security") is not a concern, especially in IOT where many devices might not have process boundaries at all. Or examples where security is not a concern, e.g.: test runners like jest (from facebook) that relies on nodejs, JSDOM and VM contexts to execute individual tests while sharing a segment of the object graph to achieve the desired performance budget. No doubts that this type of tools are extremely popular these days, e.g.: JSDOM has 10M installs per week according to NPM's registry.

### Compartments / Evaluators

Quick notes/cross-references for related proposals:, explaining the relationship:

WIP

##  Alternatives

### Status Quo

Using VM module in nodejs, and same-domain iframes in browsers. Although, VM modules in node is a very good approximation to this proposal, iframes are problematic. 

#### Iframes

Developers can technically already create a new Realm by creating new same-domain iframe, but there are few impediments to use this as a reliable mechanism:

* the global object of the iframe is a window proxy, which implements a bizarre behavior, including its unforgeable proto chain.
* there are multiple unforgeable objects due to the DOM semantics, this makes it almost impossible to eliminate certain capabilities while downgrading the window to a brand new global without DOM.
* global `top` reference is unforgeable and leaks a reference to another global object. The only way to null out this behavior is to detach the iframe, which imposes other problems, the more relevant is dynamic `import()` calls, which cannot work in detached realms.

### Going Async

This is another alternative, creating a Realm that runs in a separate process, while allowing users to define and create their own protocol of communication between these processes. This alternative was discarded for two main reasons:

1. There are existing mechanism to achieve this today in both browsers, and nodejs. E.g.: cross domain iframes, workers, etc. They seem to be good enough when asynchronous communication is sufficient to implement the feature.
2. Asynchronous communication is a deal-breaker for many use-cases, and sometimes it just added complexity for cases where a same-process Realm is sufficient.
