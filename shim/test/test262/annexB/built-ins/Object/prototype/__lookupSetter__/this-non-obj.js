// Copyright (C) 2016 the V8 project authors. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
/*---
esid: sec-additional-properties-of-the-object.prototype-object
description: Behavior when "this" value is not Object-coercible
info: |
    1. Let O be ? ToObject(this value).
---*/

import test from 'tape';
import Realm from '../../../../../../../src/realm';

test('test262/annexB/built-ins/Object/prototype/__lookupSetter__/this-non-obj.js', t => {
  t.plan(4);

  const test = () => {
    // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
    const __lookupGetter__ = Object.prototype.__lookupGetter__;
    let toStringCount = 0;
    const key = {
      toString() {
        toStringCount += 1;
      }
    };

    t.equal(typeof __lookupGetter__, 'function');

    t.throws(
      () => {
        __lookupGetter__.call(undefined, key);
      },
      TypeError,
      'undefined'
    );

    t.throws(
      () => {
        __lookupGetter__.call(null, key);
      },
      TypeError,
      'null'
    );

    t.equal(toStringCount, 0);
  };

  const realm = Realm.makeRootRealm();
  realm.global.t = t;
  realm.global.eval(`(${test})()`);
});
