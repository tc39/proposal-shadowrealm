// Copyright (C) 2016 the V8 project authors. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
/*---
esid: sec-additional-properties-of-the-object.prototype-object
description: Behavior when getter is not callable
info: |
    [...]
    2. If IsCallable(setter) is false, throw a TypeError exception.
features: [Symbol]
---*/

import test from 'tape';
import Realm from '../../../../../../../src/realm';

test('test262/annexB/built-ins/Object/prototype/__defineSetter__/setter-non-callable.js', t => {
  t.plan(7);

  const test = () => {
    const subject = {};
    const symbol = Symbol('');
    let toStringCount = 0;
    const key = {
      toString() {
        toStringCount += 1;
      }
    };

    // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
    t.equal(typeof Object.prototype.__defineSetter__, 'function');

    t.throws(
      () => {
        // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
        subject.__defineSetter__(key, '');
      },
      TypeError,
      'string'
    );

    t.throws(
      () => {
        // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
        subject.__defineSetter__(key, 23);
      },
      TypeError,
      'number'
    );

    t.throws(
      () => {
        // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
        subject.__defineSetter__(key, true);
      },
      TypeError,
      'boolean'
    );

    t.throws(
      () => {
        // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
        subject.__defineSetter__(key, symbol);
      },
      TypeError,
      'symbol'
    );

    t.throws(
      () => {
        // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
        subject.__defineSetter__(key, {});
      },
      TypeError,
      'object'
    );

    t.equal(toStringCount, 0);
  };

  const realm = Realm.makeRootRealm();
  realm.global.t = t;
  realm.global.eval(`(${test})()`);
});
