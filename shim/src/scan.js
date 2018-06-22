// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

// We use this walker to scan for accidental leakage of primal-realm objects.
// We don't use it in normal operation, but we export it for use in tests
// (both automatic and manual).

import { getOwnPropertyDescriptors, getPrototypeOf, ownKeys } from './commons';

export function walkObjects(start, visitor) {
  const visitQueue = new Map();

  // If val is something we should visit but aren't yet, add it to
  // visitQueue.
  function enqueue(val, parent, childname) {
    if (Object(val) !== val) {
      // ignore primitives
      return;
    }
    if (visitQueue.has(val)) {
      // Ignore if already visited
      return;
    }
    // visitQueue.set(val, [parent, childname]);
    if (typeof childname === 'symbol') {
      childname = '(symbol ??)';
    }

    visitQueue.set(val, `${visitQueue.get(parent)}.${childname}`);
  }

  function pathForObject(obj) {
    return visitQueue.get(obj);
    /*
    const seen = new Set();
    let path = '';
    let oops = 1000;
    while (oops > 0) {
      oops -= 1;
      const [parent, childname] = visitQueue.get(obj);
      if (parent === undefined || parent === start) {
        return path;
      }
      if (seen.has(parent)) {
        debugger;
        return `(cycle!).${path}`;
      }
      seen.add(parent);
      path = `${childname}.${path}`;
    }
    console.log(`oops: ${path}`);
    return 'oops';
    */
  }

  function process(_, obj) {
    /*
    try {
      console.log(`processing ${obj}`);
    } catch (e) {
      console.log('processed something that does not want to be stringified');
    }
    */
    // Immediately freeze the object to ensure reactive
    // objects such as proxies won't add properties
    // during traversal, before they get frozen.

    // Object are verified before being enqueued,
    // therefore this is a valid candidate.
    // Throws if this fails (strict mode).
    visitor(obj, pathForObject);

    enqueue(getPrototypeOf(obj), obj, '__proto__');
    const descs = getOwnPropertyDescriptors(obj);
    for (let name of ownKeys(descs)) {
      // todo: all iteration needs uncurried forEach protection
      const desc = descs[name];
      if (hasOwnProperty(desc, 'value')) {
        // todo uncurried form
        enqueue(desc.value, obj, name);
      } else {
        if (typeof name === 'symbol') {
          name = '(symbol ??)';
        }
        enqueue(desc.get, obj, `get ${name}`);
        enqueue(desc.set, obj, `set ${name}`);
      }
    }
  }

  function dequeue() {
    // New values added before forEach() has finished will be visited.
    visitQueue.forEach(process);
  }

  enqueue(start, undefined, 'root');
  dequeue();

  return visitQueue;
}
