// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

// Mitigate proxy-related security issues
// https://github.com/tc39/ecma262/issues/272

import { freeze, getOwnPropertyDescriptors, getPrototypeOf, ownKeys } from './commons';

// Objects that are deeply frozen.
const frozenSet = new WeakSet();

/**
 * "deepFreeze()" acts like "Object.freeze()", except that:
 *
 * To deepFreeze an object is to freeze it and all objects transitively
 * reachable from it via transitive reflective property and prototype
 * traversal.
 */
export function deepFreeze(node) {
  // Objects that we have frozen in this round.
  const freezingSet = new Set();

  // If val is something we should be freezing but aren't yet,
  // add it to freezingSet.
  function enqueue(val) {
    if (Object(val) !== val) {
      // ignore primitives
      return;
    }
    const type = typeof val;
    if (type !== 'object' && type !== 'function') {
      // future proof: break until someone figures out what it should do
      throw new TypeError(`Unexpected typeof: ${type}`);
    }
    if (frozenSet.has(val) || freezingSet.has(val)) {
      // Ignore if already frozen or freezing
      return;
    }
    freezingSet.add(val);
  }

  function doFreeze(obj) {
    // Immediately freeze the object to ensure reactive
    // objects such as proxies won't add properties
    // during traversal, before they get frozen.

    // Object are verified before being enqueued,
    // therefore this is a valid candidate.
    // Throws if this fails (strict mode).
    freeze(obj);

    enqueue(getPrototypeOf(obj));
    const descs = getOwnPropertyDescriptors(obj);
    ownKeys(descs).forEach(name => {
      const desc = descs[name];
      if ('value' in desc) {
        enqueue(desc.value);
      } else {
        enqueue(desc.get);
        enqueue(desc.set);
      }
    });
  }

  function dequeue() {
    // New values added before forEach() has finished will be visited.
    freezingSet.forEach(doFreeze);
  }

  function commit() {
    freezingSet.forEach(frozenSet.add, frozenSet);
  }

  enqueue(node);
  dequeue();
  commit();
}
