// Adapted from CoreJS Copyright (c) 2014-2018 Denis Pushkarev.
// This code is governed by the MIT license found in the LICENSE file.

import test from 'tape';
import { repairAccessors } from '../../src/repair/accessors';

/* eslint-disable no-restricted-properties, no-underscore-dangle */
test('repairAccessors - nofix', t => {
  t.plan(1);

  const original = Object.prototype.__lookupGetter__;

  repairAccessors();

  t.equal(Object.prototype.__lookupGetter__, original);
});

test('repairAccessors - force', specs => {
  // force repair
  // eslint-disable-next-line no-extend-native
  Object.prototype.__lookupGetter__ = () => {};
  repairAccessors();

  const {
    create,
    prototype: { __defineGetter__, __defineSetter__, __lookupGetter__, __lookupSetter__ }
  } = Object;

  specs.test('Object#__defineGetter__', t => {
    t.plan(9);

    t.equal(typeof __defineGetter__, 'function');
    t.equal(__defineGetter__.length, 2);
    t.equal(__defineGetter__.name, '__defineGetter__');

    const object = {};
    t.equal(object.__defineGetter__('key', () => 42), undefined, 'void');
    t.equal(object.key, 42, 'works');

    object.__defineSetter__('key', function() {
      this.foo = 43;
    });
    object.key = 44;
    t.ok(object.key === 42 && object.foo === 43, 'works with setter');

    t.throws(() => object.__defineSetter__('foo', undefined), TypeError, 'Throws on not function`');

    t.throws(() => __defineGetter__.call(null, 1, () => {}), TypeError, 'Throws on null as `this`');
    t.throws(
      () => __defineGetter__.call(undefined, 1, () => {}),
      TypeError,
      'Throws on undefined as `this`'
    );
  });

  specs.test('Object#__defineSetter__', t => {
    t.plan(9);

    t.equal(typeof __defineSetter__, 'function');
    t.equal(__defineSetter__.length, 2);
    t.equal(__defineSetter__.name, '__defineSetter__');

    const object = {};
    t.equal(
      object.__defineSetter__('key', function() {
        this.foo = 43;
      }),
      undefined,
      'void'
    );
    object.key = 44;
    t.equal(object.foo, 43, 'works');

    object.__defineSetter__('key', function() {
      this.foo = 43;
    });
    object.__defineGetter__('key', () => 42);
    object.key = 44;
    t.ok(object.key === 42 && object.foo === 43, 'works with getter');

    t.throws(() => object.__defineSetter__('foo', undefined), TypeError, 'Throws on not function`');

    t.throws(() => __defineSetter__.call(null, 1, () => {}), TypeError, 'Throws on null as `this`');
    t.throws(
      () => __defineSetter__.call(undefined, 1, () => {}),
      TypeError,
      'Throws on undefined as `this`'
    );
  });

  specs.test('Object#__lookupGetter__', t => {
    t.plan(14);

    t.equal(typeof __lookupGetter__, 'function');
    t.equal(__lookupGetter__.length, 1);
    t.equal(__lookupGetter__.name, '__lookupGetter__');
    // assert.looksNative(__lookupGetter__);
    t.equal(
      Object.getOwnPropertyDescriptor(Object.prototype, '__lookupGetter__').enumerable,
      false
    );
    t.equal({}.__lookupGetter__('key'), undefined, 'empty object');
    t.equal({ key: 42 }.__lookupGetter__('key'), undefined, 'data descriptor');

    const obj1 = {};
    function setter1() {}
    obj1.__defineGetter__('key', setter1);

    t.equal(obj1.__lookupGetter__('key'), setter1, 'own getter');
    t.equal(create(obj1).__lookupGetter__('key'), setter1, 'proto getter');
    t.equal(create(obj1).__lookupGetter__('foo'), undefined, 'empty proto');

    const obj2 = {};
    function setter2() {}
    const symbol2 = Symbol('key');
    obj2.__defineGetter__(symbol2, setter2);

    t.equal(obj2.__lookupGetter__(symbol2), setter2, 'own getter');
    t.equal(create(obj2).__lookupGetter__(symbol2), setter2, 'proto getter');
    t.equal(create(obj2).__lookupGetter__(Symbol('foo')), undefined, 'empty proto');

    t.throws(() => __lookupGetter__.call(null, 1, () => {}), TypeError, 'Throws on null as `this`');
    t.throws(
      () => __lookupGetter__.call(undefined, 1, () => {}),
      TypeError,
      'Throws on undefined as `this`'
    );
  });

  specs.test('Object#__lookupSetter__', t => {
    t.plan(14);

    t.equal(typeof __lookupSetter__, 'function');
    t.equal(__lookupSetter__.length, 1);
    t.equal(__lookupSetter__.name, '__lookupSetter__');
    // assert.looksNative(__lookupSetter__);
    t.equal(
      Object.getOwnPropertyDescriptor(Object.prototype, '__lookupSetter__').enumerable,
      false
    );
    t.equal({}.__lookupSetter__('key'), undefined, 'empty object');
    t.equal({ key: 42 }.__lookupSetter__('key'), undefined, 'data descriptor');

    const obj1 = {};
    function setter1() {}
    obj1.__defineSetter__('key', setter1);

    t.equal(obj1.__lookupSetter__('key'), setter1, 'own getter');
    t.equal(create(obj1).__lookupSetter__('key'), setter1, 'proto getter');
    t.equal(create(obj1).__lookupSetter__('foo'), undefined, 'empty proto');

    const obj2 = {};
    function setter2() {}
    const symbol2 = Symbol('key');
    obj2.__defineSetter__(symbol2, setter2);

    t.equal(obj2.__lookupSetter__(symbol2), setter2, 'own getter');
    t.equal(create(obj2).__lookupSetter__(symbol2), setter2, 'proto getter');
    t.equal(create(obj2).__lookupSetter__(Symbol('foo')), undefined, 'empty proto');

    t.throws(() => __lookupSetter__.call(null, 1, () => {}), TypeError, 'Throws on null as `this`');
    t.throws(
      () => __lookupSetter__.call(undefined, 1, () => {}),
      TypeError,
      'Throws on undefined as `this`'
    );
  });
});
