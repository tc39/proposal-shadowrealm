# Errors Propagation in ShadowRealm

This document describes the various mechanism that different browsers must implement when exposing information via Error objects. The objective is to provide guidance for implementers.

## Errors Crossing Callable Boundary

Errors thrown across the ShadowRealm's callable boundary in either direction are replaced by a fresh `TypeError` as described by the spec. Additionally, the new `TypeError` instance can be augmented with a `message` properties to help developers.

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

This error allows developers to clearly understand that the error was thrown from another Realm. If the error crosses multiple nested ShadowRealms, the second time the error is copied when crossing another boundary, the message should still be formed from scratch rather than providing nesting of the message. The same applies to re-entrancing as well since the error re-entering the ShadowRealm where it was originated, will come as a brand new TypeError object, with no visible reference to the original Error object.

Accessing the `name` and `message` of the original Error object must not be observed by user-land code. The following logic may be used:

If _originalError_ has an `[[ErrorData]]` internal slot, then use the data values of `name` and `message` of the data properties. In case of accessor properties, use the cached values stored during the creation of the original error by the host.

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
