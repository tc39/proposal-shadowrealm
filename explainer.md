# Realms Explainer

<!-- vscode-markdown-toc -->
* [Introduction](#Introduction)
* [API (TypeScript Format)](#APITypeScriptFormat)
	* [Quick API Usage Example](#QuickAPIUsageExample)
* [Motivations](#Motivations)
* [Clarifications](#Clarifications)
	* [Terminology](#Terminology)
	* [The Realm's Global Object](#TheRealmsGlobalObject)
	* [Evaluation](#Evaluation)
	* [Module Graph](#ModuleGraph)
	* [Compartments](#Compartments)
* [Use Cases](#UseCases)
	* [_Trusted_ Third Party Scripts](#Trusted_ThirdPartyScripts)
	* [Code Testing](#CodeTesting)
		* [Running tests in a Realm](#RunningtestsinaRealm)
		* [Test FWs + Tooling to run tests in a realm](#TestFWsToolingtoruntestsinarealm)
	* [Codebase segmentation](#Codebasesegmentation)
	* [Template libraries](#Templatelibraries)
	* [DOM Virtualization](#DOMVirtualization)
		* [DOM Virtualization: AMP WorkerDOM Challenge](#DOMVirtualization:AMPWorkerDOMChallenge)
		* [JSDOM + vm Modules](#JSDOMvmModules)
	* [Virtualized Environment](#VirtualizedEnvironment)
		* [DOM mocking](#DOMmocking)
* [Modules](#Modules)
* [Integrity](#Integrity)
	* [Security vs Integrity](#SecurityvsIntegrity)
* [More Examples](#MoreExamples)
	* [Example: Simple Realm](#Example:SimpleRealm)
	* [Example: Importing Module](#Example:ImportingModule)
	* [Example: Virtualized Contexts](#Example:VirtualizedContexts)
	* [Example: Simple Subclass](#Example:SimpleSubclass)
	* [Example: DOM Mocking](#Example:DOMMocking)
	* [Example: iframes vs Realms](#Example:iframesvsRealms)
	* [Example: Indirect Evaluation](#Example:IndirectEvaluation)
	* [Example: Direct Evaluation](#Example:DirectEvaluation)
	* [Example: Identity Discontinuity](#Example:IdentityDiscontinuity)
* [Example: Node's vm objects vs Realms](#Example:NodesvmobjectsvsRealms)
* [Status Quo](#StatusQuo)
* [Iframes](#Iframes)
	* [Detachable](#Detachable)
	* [Why not separate processes?](#Whynotseparateprocesses)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

## <a name='Introduction'></a>Introduction

The Realms proposal provides a new mechanism to execute JavaScript code within the context of a new global object and set of JavaScript built-ins. The `Realm` constructor creates this kind of a new global object.

Realms execute code with the same JavaScript heap as the surrounding context where the Realm is created. Code runs synchronously in the same thread.

Same-origin iframes also create a new global object which is synchronously accessible. Realms differ from same-origin iframes by omitting Web APIs such as the DOM.

Sites like salesforce.com make extensive use of same-origin iframes to create such global objects. Our experience with same-origin iframes motivated us to create this proposal, which has the following advantages:

We hope that it will be somewhat lighter weight (both in terms of memory and CPU) for the browser to create new Realms than iframes.
Frameworks do not need to first clear out existing Web APIs when customizing the global object of the Realm.
The framework can determine the set of APIs exposed to code which executes in the Realm, which is difficult to achieve in iframes due to the presence of `[LegacyUnforgeable]` attributes like `Window.top`

Realms are complementary to stronger isolation mechanisms such as Workers and cross-origin iframes. They are useful for contexts where synchronous execution is an essential requirement, e.g., emulating the DOM for integration with third-party code. Realms avoid often-prohibitive serialization overhead by using a common heap to the surrounding context.

JavaScript modules are associated with a global object and set of built-ins. Realms contain their own separate module graph which runs in the context of that Realm, so that a full JavaScript development experience is available

## <a name='APITypeScriptFormat'></a>API (TypeScript Format)

This is The Realms API description in TypeScript format:

```ts
declare class Realm {
    constructor();
    readonly globalThis: typeof globalThis;
    import(specifier: string): Promise<Namespace>;
}
```

The proposed specification defines:

- The [`constructor`](https://tc39.es/proposal-realms/#sec-realm).
- The [`Realm#import()`](https://tc39.es/proposal-realms/#sec-realm.prototype.import) method, equivalent to the `import()` expression.
- The [`get Realm#globalThis`](https://tc39.es/proposal-realms/#sec-realm.prototype.import) accessor to the Realm's `globalThis`. This global 

### <a name='QuickAPIUsageExample'></a>Quick API Usage Example

```js
// this is the root realm
var x = 39;
const realm = new Realm();

// globals from the root/parent realm are not leaked to the nested realms
realm.globalThis.x; // undefined
realm.globalThis.x = 42; // 42

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

## <a name='Motivations'></a>Motivations

Why do developers need realms?

It's quite common for an applications to contain programs from multiple sources, whether from different teams, vendors, package managers, etc. These programs must currently contend for the global shared resources, specifically, the shared global object, and the side effect of executing those programs are often hard to observe, causing conflicts between the different programs, and potentially affecting the integrity of the app itself.

Asynchronous communication is a deal-breaker for many use cases. It usually just adds complexity for cases where a same-process Realm is sufficient. It's also very important that values can be immediately shared. Other communications require data to be serialized before it's sent back and forth.

It would be good to provide a _lightweight funcionality_ - optimistically! - instead of creating iframes or Workers.

The functionalities of the VM module in Node can also be standardized here.

There are various examples where Realms can be used to avoid this:

  * Web-based IDEs or any kind of 3rd party code execution uses same origin evaluation.
  * DOM Virtualization (e.g.: AMP)
  * Test frameworks and reporters(in-browser tests, but also in node using `vm`).
  * testing/mocking (e.g.: jsdom)
  * Most plugin mechanism for the web (e.g., spreadsheet functions).
  * Sandboxing (e.g.: Oasis Project)
  * Server side rendering (to avoid collision and data leakage)
  * in-browser code editors
  * in-browser transpilation

Note: the majority of the examples above will require synchronous operations to be supported, which makes it almost impossible to use Workers or similars, or any other isolation mechanisms in browsers and nodejs today.

## <a name='Clarifications'></a>Clarifications

### <a name='Terminology'></a>Terminology

In the Web Platform, both `Realm` and `Global Object` are usually associated to Window, Worker, and Worklets semantics. They are also associated to their detachable nature, where they can be pulled out from their parent DOM tree.

This proposal is limited to the semantics specified by ECMA-262 with no extra requirements from the web counterparts.

### <a name='TheRealmsGlobalObject'></a>The Realm's Global Object

Each Realm's [Global Object](https://tc39.es/ecma262/#sec-ordinary-object) is an [Ordinary Object](https://tc39.es/ecma262/#sec-ordinary-object). It does not require exotic internals or new primitives.

Instances of Realm Objects and their Global Objects have their lifeline to their incubator Realm, they are not _detachable_ from it. Instead, they work as a group, sharing the settings of their incubator Realm. In other words, they act as encapsulation boundaries, they are analogous to a closure or a private field.

![](assets/detachable-realms.png)

### <a name='Evaluation'></a>Evaluation

The Realms API does not introduce a new way to evaluate code, it is subject to the existing evaluation mechanisms such as the [Content-Security-Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy).

If the CSP directive from a page disallows `unsafe-eval`, it prevents synchronous evaluation in the Realm. E.g.: `Realm#globalThis.eval`, `Realm#globalThis.Function`.

The CSP of a page can also set directives like the `default-src` to prevent a Realm from using `Realm#import()`.

### <a name='ModuleGraph'></a>Module Graph

Each instance of Realms must have its own Module Graph.

```js
const realm = new Realm();

// imports code that executes within its own environment.
const { doSomething } = await realm.import('./file.js');

doSomething();
```

### <a name='Compartments'></a>Compartments

This proposal does not define any compartmentalization of host behavior. Therefore, it distinguishes itself from the current existing [Compartments](https://github.com/tc39/proposal-compartments) proposal.

A new [Compartment](https://github.com/tc39/proposal-compartments) provides a new Realm constructor. A Realm object from a Compartment is subject to the Compartment's virtualization mechanism.

```js
const compartment = new Compartment(options);
const VirtualizedRealm = compartment.globalThis.Realm;
const realm = new VirtualizedRealm();
const { doSomething } = await realm.import('./file.js');
```

The Realms API does not introduce a new way to evaluate code, it is subject to the existing evaluation mechanisms such as the [Content-Security-Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy).

## <a name='UseCases'></a>Use Cases

These are some of the key use cases where The Realms API becomes very useful and important:

- Third Party Scripts
- Code Testing
- Codebase segmentation
- Template libraries
- DOM Virtualization

### <a name='Trusted_ThirdPartyScripts'></a>_Trusted_ Third Party Scripts

We acknowledge that applications need a quick and simple execution of Third Party Scripts. There are cases where **many** scripts are executed for the same application. There isn't a need for a new host or agent. This is also not aiming for prevention over non-Trusted Third Party Scripts like malicious code or xss injections. Our focus is on multi libraries and building blocks from different authors.

The Realms API provides integrity preserving semantics - including built-ins - of root and incubator Realms, setting specific boundaries for the Environment Records.

Third Party Scripts can be executed in a non-blocking asynchronous evaluation through the `Realm#import()`.

There is no need for immediate access to the application globals - e.g. `window`, `document`. This comes as a convenience for the application that can provide - or not - values and API in different ways, like frozen properties set in the `Realm#globalThis`. This also creates several opportunities for customization with the Realm Globals and prevent collision with other global values and other third party scripts.

```js
import { fmw } from 'pluginFramework';
const realm = new Realm();

// fmw becomes available in the Realm
realm.globalThis.fmw = fmw;

// The Plugin Script will execute within the Realm
await realm.import('./pluginScript.js');
```

### <a name='CodeTesting'></a>Code Testing

While multi-threading is useful for testing, the layering enabled from Realms is also great. Test frameworks can use Realms to inject code and also control the order the injections if necessary.

Testing code can run autonomously within the boundaries set from the Realm object, without immediately conflicting with other tests.

#### <a name='RunningtestsinaRealm'></a>Running tests in a Realm

```js
import { test } from 'testFramework';
const realm = new Realm();

realm.globalThis.test = test;
await realm.import('./main-spec.js');

test.report();
```

#### <a name='TestFWsToolingtoruntestsinarealm'></a>Test FWs + Tooling to run tests in a realm

```js
const realm = new Realm();
const [ framework, { tap } ] = await Promise.all([
 realm.import('testFramework'),
 realm.import('reporters')
]);

framework.use(tap);
await realm.import('./main-spec.js');
```

### <a name='Codebasesegmentation'></a>Codebase segmentation

A big codebase tend to evolve slowly and soon becomes legacy code. Old code vs new code is a constant struggle for developers.

Modifying code to resolve a conflict (e.g.: global variables) is non-trivial, specially in big codebases.

The Realms API can provide a _lightweight_ mechanism to preserve the integrity of the intrinsics.0 Therefore, it could isolate libraries or logical pieces of the codebase per Realm.

### <a name='Templatelibraries'></a>Template libraries

Code generation should not be subject to pollution (global, prototype, etc.). E.g.: Lodash's `_.template()` uses `Function(...)` to create a compiled template function, instead it could use a Realm to avoid leaking global variables. The same Realm could be reused multiple times.

```js
var compiled = _.template(
'<% _.forEach(users, function(user) { %><li><%- user %></li><% }); %>'
);

compiled({ users: ['user1', 'user2'] });
```

### <a name='DOMVirtualization'></a>DOM Virtualization

We still want things to interact with the DOM without spending any excessive amount of resources.

It is important for applications to emulate the DOM as best as possible. Requiring authors to change their code to run in our virtualized environment is difficult. Specially if they are using third party libraries.

```js
import virtualDocument from 'virtual-document';

const realm = new Realm();

realm.globalThis.document = virtualDocument;

await realm.import('./publisher-amin.js');
```

#### <a name='DOMVirtualization:AMPWorkerDOMChallenge'></a>DOM Virtualization: AMP WorkerDOM Challenge

Problem: `Element.getBoundingClientRect()` doesn't work over async comm channels (i.e. [worker-dom](https://github.com/ampproject/worker-dom)).

![AMP WorkerDOM Challenge diagram](assets/amp-workerdom-challenge.png)

The communication is also limited by serialization aspects of [transferable objects](https://html.spec.whatwg.org/multipage/structured-data.html#transferable-objects), e.g.: functions or Proxy objects are not _transferable_.

#### <a name='JSDOMvmModules'></a>JSDOM + vm Modules

JSDOM [relies on VM](https://github.com/jsdom/jsdom/blob/0b1f84f499a0b23fad054228b34412869f940765/lib/jsdom/living/nodes/HTMLScriptElement-impl.js#L221-L248) functionality to emulate the __HTMLScriptElement__ and maintains a [shim of the vm module](https://github.com/jsdom/jsdom/blob/bfe7de63d6b1841053d572a915b2ff06bd4357b9/lib/jsdom/vm-shim.js) when it is bundled to run in a webpage where it doesn’t have access to the Node's __vm__ module.

The Realms API provides a single API for this virtualization in both browsers and NodeJS.

### <a name='VirtualizedEnvironment'></a>Virtualized Environment

The usage of different realms allow customized access to the global environment. To start, The global object could be immediately frozen.

```js
let realm = new Realm();

Object.freeze(realm.globalThis);
```

In web browsers, this is currently not possible. The way to get manage new Realms would be through iframes, but they also share a window proxy object.

```js
let iframe = document.createElement('iframe');
document.body.appendChild(iframe);
const rGlobal = iframe.contentWindow; // same as iframe.contentWindow.globalThis

Object.freeze(rGlobal); // TypeError, cannot freeze window proxy
```

The same iframe approach won't also have a direct access to import modules dynamically. The usage of `realm.import('./file.js');` is possible instead of roughly using eval functions or setting _script type module_ in the iframe, if available.

#### <a name='DOMmocking'></a>DOM mocking

The Realms API allows a much smarter approach for DOM mocking, where the globalThis can be setup in userland. This also takes advantage of the Realm constructor being subclassable:

```js
class FakeWindow extends Realm {
  constructor(...args) {
    super(...args);
    let realmGlobal = this.globalThis;

    realmGlobal.document = new FakeDocument();
    realmGlobal.top = 'https://example.com';
  }
}
```

This code allows a customized set of properties to each new Realm and avoid issues on handling immutable accessors/properties from the Window proxy. e.g.: `window.top`, `window.location`, etc..

## <a name='Modules'></a>Modules

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

## <a name='Integrity'></a>Integrity

We believe that realms can be a good complement to integrity mechanisms by providing ways to evaluate code who access different object graphs (different global objects) while maintaining the integrity of the outer realm. A concrete example of this is the Google's AMP current mechanism:

* Google News App creates multiples sub-apps that can be presented to the user.
* Each sub-app runs in a cross-domain iframe (communicating with the main app via post-message).
* Each vendor (one per app) can attempt to enhance their sub-app that display their content by executing their code in a realm that provide access to a well defined set of APIs to preserve the integrity of the sub-app.

There are many examples like this for the web: Google Sheets, Figma's plugins, or Salesforce's Locker Service for Web Components.

### <a name='SecurityvsIntegrity'></a>Security vs Integrity

There are also other more exotic cases in which measuring of time ("security") is not a concern, especially in IOT where many devices might not have process boundaries at all. Or examples where security is not a concern, e.g.: test runners like jest (from facebook) that relies on nodejs, JSDOM and VM contexts to execute individual tests while sharing a segment of the object graph to achieve the desired performance budget. No doubts that this type of tools are extremely popular these days, e.g.: JSDOM has 10M installs per week according to NPM's registry.

## <a name='MoreExamples'></a>More Examples

### <a name='Example:SimpleRealm'></a>Example: Simple Realm

```js
let g = globalThis; // outer global
let r = new Realm(); // root realm

let f = r.globalThis.Function("return 17");

f() === 17 // true

Reflect.getPrototypeOf(f) === g.Function.prototype // false
Reflect.getPrototypeOf(f) === r.globalThis.Function.prototype // true
```

### <a name='Example:ImportingModule'></a>Example: Importing Module

```js
let r = new Realm();
const { x } = await r.import('/path/to/foo.js');
```

In this example, the new realm will fetch, and evaluate the module, and extract the `x` named export from that module namespace. `Realm.prototype.import` is equivalent to the dynamic import syntax (e.g.: `const { x } = await import('/path/to/foo.js');` from within the realm. In some cases, evaluation will not be available (e.g.: in browsers, CSP might block unsafe-eval), while importing from module is still possible.

### <a name='Example:VirtualizedContexts'></a>Example: Virtualized Contexts

Importing modules allow us to run asynchronous executions with set boundaries for access to global environment contexts.

- `main.js`:

```js
globalThis.DATA = "a global value";

let r = new Realm();

// r.import is equivalent to the dynamic import expression
// It provides asynchronous execution, without creating or relying in a
// different thread or process.
r.import("./sandbox.js").then(({test}) => {

  // globals in this root realm are not leaked
  test("DATA"); // undefined

  let desc = test("Array"); // {writable: true, enumerable: false, configurable: true, value: ƒ}
  let Arr = desc.value;

  Arr === r.globalThis.Array; // true
  Arr === Array; // false

  // foo and bar are immediately visible as globals here.
});
```

- `sandbox.js`:

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

### <a name='Example:SimpleSubclass'></a>Example: Simple Subclass

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

### <a name='Example:DOMMocking'></a>Example: DOM Mocking

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

### <a name='Example:iframesvsRealms'></a>Example: iframes vs Realms

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

### <a name='Example:IndirectEvaluation'></a>Example: Indirect Evaluation

This operation should be equivalent, in both scenarios:

```js
globalOne.eval('1 + 2'); // yield 3
globalTwo.eval('1 + 2'); // yield 3
```

### <a name='Example:DirectEvaluation'></a>Example: Direct Evaluation

This operation should be equivalent, in both scenarios:

```js
globalOne.eval('eval("1 + 2")'); // yield 3
globalTwo.eval('eval("1 + 2")'); // yield 3
```

### <a name='Example:IdentityDiscontinuity'></a>Example: Identity Discontinuity

Considering that you're creating a brand new realm, with its brand new global variable,
the identity discontinuity is still present, just like in the iframe example:

```js
let a1 = globalOne.eval('[1,2,3]');
let a2 = globalTwo.eval('[1,2,3]');
a1.prototype === a2.prototype; // yield false
a1 instanceof globalTwo.Array; // yield false
a2 instanceof globalOne.Array; // yield false
```

## <a name='Example:NodesvmobjectsvsRealms'></a>Example: Node's vm objects vs Realms

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

## <a name='StatusQuo'></a>Status Quo

Using VM module in nodejs, and same-domain iframes in browsers. Although, VM modules in node is a very good approximation to this proposal, iframes are problematic. 

## <a name='Iframes'></a>Iframes

Developers can technically already create a new Realm by creating new same-domain iframe, but there are few impediments to use this as a reliable mechanism:

* the global object of the iframe is a window proxy, which implements a bizarre behavior, including its unforgeable proto chain.
* There are multiple ~~unforgeable~~ unvirtualizable objects due to the DOM semantics, this makes it almost impossible to eliminate certain capabilities while downgrading the window to a brand new global without DOM.
* The global `top` reference cannot be redefined and leaks a reference to another global object. The only way to null out this behavior is to __detach__ the iframe, which imposes other problems, the more relevant is dynamic `import()` calls.

### <a name='Detachable'></a>Detachable

For clarifications, the term detachable means an iframe pulled out from the DOM tree:

```js
var iframe = document.createElement("iframe");

 // attaching the iframe to the DOM tree
document.body.appendChild(iframe);

var iframeWindow = iframe.contentWindow;

// Get accessor that returns the topmost window.
iframeWindow.top; // Cannot be properly redefined/virtualized: { get: top(), set: undefined, enumerable: true, configurable: false }

// **detaching** the iframe
document.body.removeChild(iframe);

// get accessor still exists, now returns null
iframeWindow.top;
```

### <a name='Whynotseparateprocesses'></a>Why not separate processes?

Creating a Realm that runs in a separate process is another alternative, while allowing users to define and create their own protocol of communication between these processes.

This alternative was discarded for two main reasons:

1. There are existing mechanism to achieve this today in both browsers, and nodejs. E.g.: cross domain iframes, workers, etc. They seem to be good enough when asynchronous communication is sufficient to implement the feature.
2. Asynchronous communication is a deal-breaker for many use-cases, and sometimes it just added complexity for cases where a same-process Realm is sufficient.

There are some identified challenges explained within the current use cases for Realms such as the [WorkerDOM Virtualization challenge for Google AMP](#DOMVirtualization) and the current use of [JSDOM and Node VM modules](#JSDOMvmModules) that would be better placed using an interoperable Realms API as presented by this proposal.
