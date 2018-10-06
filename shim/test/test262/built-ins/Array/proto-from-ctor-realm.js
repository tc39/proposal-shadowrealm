// Copyright (C) 2016 the V8 project authors. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
/*---
esid: sec-array.from
es6id: 22.1.2.1
description: Default [[Prototype]] value derived from realm of the constructor
info: |
    [...]
    5. If usingIterator is not undefined, then
       a. If IsConstructor(C) is true, then
          i. Let A be ? Construct(C).
    [...]

    9.1.14 GetPrototypeFromConstructor

    [...]
    3. Let proto be ? Get(constructor, "prototype").
    4. If Type(proto) is not Object, then
       a. Let realm be ? GetFunctionRealm(constructor).
       b. Let proto be realm's intrinsic object named intrinsicDefaultProto.
    [...]
features: [cross-realm]
---*/

import test from 'tape';
import Realm from '../../../../src/realm';

test('test262/built-ins/Array/proto-from-ctor-realm.js', t => {
  t.plan(1);

  const realm = Realm.makeRootRealm();
  realm.global.t = t;
  realm.global.eval(`
    const other = Realm.makeRootRealm().global;
    const C = new other.Function();
    C.prototype = null;

    const o = Reflect.construct(Array, [], C);

    t.equal(Object.getPrototypeOf(o), other.Array.prototype);
  `);
});
