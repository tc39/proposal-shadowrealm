// Copyright (C) 2016 the V8 project authors. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
/*---
esid: sec-array-exotic-objects-defineownproperty-p-desc
es6id: 9.4.2.1
description: >
  Error when setting a length larger than 2**32 (honoring the Realm of the
  current execution context)
info: |
  [...]
  2. If P is "length", then
     a. Return ? ArraySetLength(A, Desc).
features: [cross-realm]
---*/

import test from 'tape';
import Realm from '../../../../../src/realm';

test('test262/built-ins/Array/length/define-own-prop-length-overflow-realm.js', t => {
  t.plan(1);

  const test = () => {
    const other = Realm.makeRootRealm().global;
    const OArray = other.Array;
    const array = new OArray();

    t.throws(() => {
      array.length = 4294967296;
    }, RangeError);
  };

  const realm = Realm.makeRootRealm();
  realm.global.t = t;
  realm.global.eval(`(${test})()`);
});
