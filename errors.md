# Errors Propagation in ShadowRealm

This document describes the various mechanism that different browsers must implement when exposing message and stack information via Error objects. The objective is to provide guidance for implementers.

## Errors Crossing Callable Boundary

Errors thrown across the ShadowRealm's callable boundary in either direction are replaced by a fresh `TypeError` as described by the spec. Additionally, the new `TypeError` instance can be augmented with a `message` and `stack` properties to help developers.

### New Error.message

The new `TypeError` object created to propagate an error across the callable boundary can be augmented with a `message` property. The value of such property can be a combination of `name` and `message` from the original error. E.g.:

Original `error.message`:

```
TypeError: null has no properties
```

New `error.message` after crossing a boundary:

```
TypeError: wrapped function threw, error was TypeError: null has no properties
```

This error allows developers to clearly understand that the error was thrown from another Realm. If the error crosses multiple nested ShadowRealms, the second time the error is created when crossing another boundary, the message should still be formed from scratch rather than providing nesting of the message. The same applies to re-entrancing as well since the error re-entring the ShadowRealm where it was originated, will come as a brand new TypeError object, with no connection to the original Error object.

Accessing the `name` and `message` of the original Error object must not be observed by the user-land code. The following logic may be used:

If _originalError_ has an `[[ErrorData]]` internal slot, then use the data values of `name` and `message` of the data properties. In case of accesor properties, use the cached values stored during the creation of the original error by the host.

_Note: It is possible to only cache the `name` and `message` if the error could cross a boundary (based on the stack frames)._

If _originalError_ does not have an `[[ErrorData]]` internal slot, then produce a generic message. E.g.:

```js
function x() {
    throw someObject;
}
```

It produces a TypeError with the following message:

```
wrapped function threw, error was uncaught exception: Object
```

_Note: FF implementation follows the logic described above._

### error.stack

A good error message is sometimes not enough. We encourage engines to enable their engine-specific stack introspection mechanisms for errors in ShadowRealms. In this case, the Error's stack is subject to censorship constraints.

Some of the use-cases for ShadowRealm, e.g., the virtualization, require a mechanism to control the error's stack, so those accessing it should not observe that the program is running inside a ShadowRealm. Early versions of the spec were simply nulling out the stack when an error crosses the callable boundary, but that was not sufficient, in fact, it was faulty for two main reasons:

1. It was impossible for developers to figure out where the error occurred, including errors from the module graph linkage phase.
2. Errors originated from within a ShadowRealm, and observed inside the same ShadowRealm, were still leaking all the information.

This document describes how to solve both of these problems by applying a censoring process for all errors.

#### Censoring Error objects accessible within ShadowRealms

The first step is to make sure that when an error of any kind is observed (by reference) inside a ShadowRealm instance, the host is censoring all stack frames that are not associated to the ShadowRealm instance itself. This allows the following example to work properly:

```js
try { null.foo } catch (e) {
    console.log(e.stack);
    throw e;
}
```

In the example above, `e` never crossed a callable boundary, but regardless, it should not contain a stack frame associated to another realm. Assuming that this error is observed (accessed) in two different places, a try/catch from above when running inside the ShadowRealm instances, and another try/catch in the incubator realm, which happens to be the main page (top level window), we should see two different error's stack for the two different errors:

1. ShadowRealm's `error.stack`:
```
foo@http://127.0.0.1:8081/y.js:2:5
bar@http://127.0.0.1:8081/y.js:6:12
captureStack@http://127.0.0.1:8081/x.js:9:9
```

_Note: Only the 3 stack frames must be exposed on this error because they correspond to code evaluated inside the ShadowRealm associated to the error instance._

2. Main page's `Error.stack`:
```
foo@http://127.0.0.1:8081/y.js:2:5
bar@http://127.0.0.1:8081/y.js:6:12
captureStack@http://127.0.0.1:8081/x.js:9:9
runInSandbox@http://127.0.0.1:8081/demo.html:6:17
@http://127.0.0.1:8081/demo.html:8:1
```

_Note: All 5 stack frames should be exposed on this error regardless of their location and associated Realms, this is analogous to what happen with same domain iframes today._

In the example above, we have 2 modules, `x.js` and `y.js`:

```js
import { foo, bar } from './y.js';

export function letItThrow() {
    return foo();
}

export function captureStack() {
    try {
        bar();
    } catch (e) {
        return e.stack;
    }
    return '';
}
```

```js
export function foo() {
    return null.x;
}

export function bar() {
    return foo();
}
```

The incubator realm running (demo.html) can do the following:

```js
const s = new ShadowRealm();
const letItThrow = await s.importValue('./x.js', 'letItThrow');
const captureStack = await s.importValue('./x.js', 'captureStack');
function runInSandbox() {
    letItThrow();
    // or captureStack();
}
runInSandbox();
```

#### When not to censor Errors?

Since ShadowRealm provides integrity guarantees, errors instances belonging to a ShadowRealm are only accessible inside the ShadowRealm (thanks to the callable boundary), this censoring process only affect errors inside a ShadowRealm, developers, and dev-tools observing errors at the top level (main window), should still be able to observe the full stack information. This covers tools to collect metrics about errors, and any other mechanism running on the main program.

### Example

Now, let's assume that we have 3 programs:

 - Main Program (running on top level)
   - Program A (running inside a ShadowRealm created by the Main Program)
     - Program B (running inside a ShadowRealm created by Program A)

The same mechanism must be applied if the error was generated by a child ShadowRealm B (Program B), which was created by Program A. Let's explore the different scenarios:

1. A try/catch in Program B catches the error, it will qualify to be censored, only revealing stack frames associated to the ShadowRealm where Program B runs, and none from Program A or the Main Program.
1. A try/catch in Program A catches the error, it will qualify to be censored, only revealing stack frames associated to the ShadowRealm where Program A runs, and none from Program B or the Main Program.

Hosts can:

a) identify, at the time of creation of the original Error instance, if that error might cross the callable boundary, and store the original stack information, along with the `name` and `meessage`.
b) generate a censored stack information depending on the realm observing the error.
c) generate the stack information lazily by producing the stack when it is accessed the first time per realm.
