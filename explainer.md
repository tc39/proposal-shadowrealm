# Realms Explainer

## Introduction

Realms are a distinct global environment, with its own global object containing its own intrinsics and built-ins (standard objects that are not bound to global variables, like the initial value of Object.prototype).

The Realms API allow execution of script within an isolated [global environment record](https://tc39.es/ecma262/#sec-global-environment-records). Just like the the Global Environment Record, each new realm will provide the [bindings for built-in globals](https://tc39.es/ecma262/#table-7), properties of the [global object](https://tc39.es/ecma262/#sec-global-object), and for all top-level declarations that occur within the Realm's Script.

The Realms API does not create - or rely on - a new executing thread. New realms will not behave like different [Agents](https://tc39.es/ecma262/#sec-agents). Although, the Realms API offers a way to import modules asynchronously, just like the `import()` expression, following the same design patterns. It also offers a way to execute code synchronously, through regular evaluation built-ins.

Any code executed within this realm may introduce changes to global variables or built-ins, but limited to the realm global Record.

## API (TypeScript Format)

```ts
declare class Realm {
    constructor();
    readonly globalThis: typeof globalThis;
    import(specifier: string): Promise<Namespace>;
}
```

### Intuitions

* sandbox
* virtualization / testing
* iframe without DOM
* principled version of Node's `'vm'` module
* sync Worker

## Motivations

Why do developers need realms?

It's quite common for an applications to contain programs from multiple sources, whether from different teams, vendors, package managers, etc. These programs must currently contend for the global shared resources, specifically, the shared global object, and the side effect of executing those programs are often hard to observe, causing conflicts between the different programs, and potentially affecting the integrity of the app itself.

Various examples where Realms can be used to avoid this:

  * Web-based IDEs or any kind of 3rd party code execution uses same origin evaluation.
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

## Use Cases

### Integrity

We believe that realms can be a good complement to integrity mechanisms by providing ways to evaluate code who access different object graphs (different global objects) while maintaining the integrity of the outer realm. A concrete example of this is the Google's AMP current mechanism:

* Google News App creates multiples sub-apps that can be presented to the user.
* Each sub-app runs in a cross-domain iframe (communicating with the main app via post-message).
* Each vendor (one per app) can attempt to enhance their sub-app that display their content by executing their code in a realm that provide access to a well defined set of APIs to preserve the integrity of the sub-app.

_TODO: cc @jridgewell to see if this is accurate._

There are many examples like this for the web: Google Sheets, Figma's plugins, or Salesforce's Locker Service for Web Components.

#### Security vs Integrity

There are also other more exotic cases in which measuring of time ("security") is not a concern, especially in IOT where many devices might not have process boundaries at all. Or examples where security is not a concern, e.g.: test runners like jest (from facebook) that relies on nodejs, JSDOM and VM contexts to execute individual tests while sharing a segment of the object graph to achieve the desired performance budget. No doubts that this type of tools are extremely popular these days, e.g.: JSDOM has 10M installs per week according to NPM's registry.

### Virtualized Environment

The usage of different realms allow customized access to the global environment. To start, The global object could be immediately frozen.

```js
let realm = new Realm();

Object.freeze(realm.globalThis);
```

In web browsers, this is currently not possible. The way to get manage new realms would be through iframes, but they also share a window proxy object.

```js
let iframe = document.createElement('iframe');
document.body.appendChild(iframe);
const rGlobal = iframe.contentWindow; // same as iframe.contentWindow.globalThis

Object.freeze(rGlobal); // TypeError, cannot freeze window proxy
```

The same iframe approach won't also have a direct access to import modules dynamically.

```js
realm.import('./file.js');

// instead of (roughly)
iframe.contentWindow.eval("import('./file.js')");
```

#### DOM mocking

The Realms API allows a much smarter approach for DOM mocking, where the globalThis can be setup in userland. This also takes advantage of the Realm constructor being subclassable:

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

This code allows a customized set of properties to each new Realm and avoid issues on handling immutable accessors/properties from the Window proxy. e.g.: `window.top`, `window.location`, etc..

## Testing

The Realms API is very useful for testing purposes. It can provide a limited context that can observe code reliance:

```js
import Tester from 'myTestFramework';

class TestRealm extends Realm {
  constructor(...args) {
    super(...args);
    const globalThis = this.globalThis;

    // Loads the globalThis with the Tester API
    Object.assign(globalThis, new Tester());

    Object.freeze(globalThis);
  }

  async exec(testFile) {
    // Assuming testFile matches a valid loader specifier
    return await this.import(testFile);
  }
}

const myTests = new TestRealm();

myTests.exec('./hanoi-tower-spec.js');
```

##  Alternatives

### Status Quo

Using VM module in nodejs, and same-domain iframes in browsers. Although, VM modules in node is a very good approximation to this proposal, iframes are problematic. 

### Iframes

Developers can technically already create a new Realm by creating new same-domain iframe, but there are few impediments to use this as a reliable mechanism:

* the global object of the iframe is a window proxy, which implements a bizarre behavior, including its unforgeable proto chain.
* there are multiple ~~unforgeable~~ unvirtualizable objects due to the DOM semantics, this makes it almost impossible to eliminate certain capabilities while downgrading the window to a brand new global without DOM.
* global `top` reference is ~~unforgeable~~ not virtualizable and leaks a reference to another global object. The only way to null out this behavior is to detach the iframe, which imposes other problems, the more relevant is dynamic `import()` calls, __which cannot work in detached realms__.

### Why not separate processes?

This is another alternative, creating a Realm that runs in a separate process, while allowing users to define and create their own protocol of communication between these processes. This alternative was discarded for two main reasons:

1. There are existing mechanism to achieve this today in both browsers, and nodejs. E.g.: cross domain iframes, workers, etc. They seem to be good enough when asynchronous communication is sufficient to implement the feature.
2. Asynchronous communication is a deal-breaker for many use-cases, and sometimes it just added complexity for cases where a same-process Realm is sufficient.
