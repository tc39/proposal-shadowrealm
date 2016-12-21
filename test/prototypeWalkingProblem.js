// Copyright (C) 2016 Dan Connolly. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
 description: incompletely confined realms
 includes: [realm-shim.js]
 info: >
   See slide "Is Alice's API surface defensive?" at 22:15 in
   https://drive.google.com/file/d/0Bw0VXJKBgYPMeFRjenpFb0dYNnM/view
---*/

function Alice() {
    //const rootA = Realm.immutableRoot();
    const rootA = new RealmShim();

    function confine(src, endowments) {
        // TODO: as of 13 Dec 3d2eb02, .spawn() is not
        // supported by the shim, so we get:
        //   TypeError: rootA.spawn is not a function
        return rootA.spawn(endowments).eval(src);
    }
    function Counter() {
        let count = 0;
        return Object.freeze({
            incr: () => ++count,
            decr: () => --count
        });
    }

    const counter = Counter();

    const bobSrc = String(Bob);
    const bob = confine(bobSrc, {change: counter.incr});
    //const carol = confine(carlSrc, {change: counter.decr});
}

function Bob() {
    let stash = null;
    change.__proto__.__proto__.toString = function() { stash = this; };
    // TODO: come back in a later turn when Alice has called toString
    // and we can exploit the stash.
}

Alice();
