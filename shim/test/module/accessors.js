// Adapted from CoreJS Copyright (c) 2014-2018 Denis Pushkarev.
// This code is governed by the MIT license found in the LICENSE file.

import test from 'tape';
import { repairAccessors } from '../../src/accessors';

/* eslint-disable no-restricted-properties, no-underscore-dangle */

repairAccessors();

const {
  create,
  prototype: { __defineGetter__, __defineSetter__, __lookupGetter__, __lookupSetter__ }
} = Object;

test('Object#__defineGetter__', t => {
  t.plan(8);

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

  t.throws(() => __defineGetter__.call(null, 1, () => {}), TypeError, 'Throws on null as `this`');
  t.throws(
    () => __defineGetter__.call(undefined, 1, () => {}),
    TypeError,
    'Throws on undefined as `this`'
  );
});

test('Object#__defineSetter__', t => {
  t.plan(8);

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

  t.throws(
    () =>
      __defineSetter__.call(null, 1, () => {
        /* empty */
      }),
    TypeError,
    'Throws on null as `this`'
  );
  t.throws(
    () =>
      __defineSetter__.call(undefined, 1, () => {
        /* empty */
      }),
    TypeError,
    'Throws on undefined as `this`'
  );
});

test('Object#__lookupGetter__', t => {
  t.plan(11);

  t.equal(typeof __lookupGetter__, 'function');
  t.equal(__lookupGetter__.length, 1);
  t.equal(__lookupGetter__.name, '__lookupGetter__');
  // assert.looksNative(__lookupGetter__);
  t.equal(Object.getOwnPropertyDescriptor(Object.prototype, '__lookupGetter__').enumerable, false);
  t.equal({}.__lookupGetter__('key'), undefined, 'empty object');
  t.equal({ key: 42 }.__lookupGetter__('key'), undefined, 'data descriptor');

  const object = {};
  function setter() {}
  object.__defineGetter__('key', setter);

  t.equal(object.__lookupGetter__('key'), setter, 'own getter');
  t.equal(create(object).__lookupGetter__('key'), setter, 'proto getter');
  t.equal(create(object).__lookupGetter__('foo'), undefined, 'empty proto');

  t.throws(() => __lookupGetter__.call(null, 1, () => {}), TypeError, 'Throws on null as `this`');
  t.throws(
    () => __lookupGetter__.call(undefined, 1, () => {}),
    TypeError,
    'Throws on undefined as `this`'
  );
});

test('Object#__lookupSetter__', t => {
  t.plan(11);

  t.equal(typeof __lookupSetter__, 'function');
  t.equal(__lookupSetter__.length, 1);
  t.equal(__lookupSetter__.name, '__lookupSetter__');
  // assert.looksNative(__lookupSetter__);
  t.equal(Object.getOwnPropertyDescriptor(Object.prototype, '__lookupSetter__').enumerable, false);
  t.equal({}.__lookupSetter__('key'), undefined, 'empty object');
  t.equal({ key: 42 }.__lookupSetter__('key'), undefined, 'data descriptor');

  const object = {};
  function setter() {}
  object.__defineSetter__('key', setter);

  t.equal(object.__lookupSetter__('key'), setter, 'own getter');
  t.equal(create(object).__lookupSetter__('key'), setter, 'proto getter');
  t.equal(create(object).__lookupSetter__('foo'), undefined, 'empty proto');

  t.throws(() => __lookupSetter__.call(null, 1, () => {}), TypeError, 'Throws on null as `this`');
  t.throws(
    () => __lookupSetter__.call(undefined, 1, () => {}),
    TypeError,
    'Throws on undefined as `this`'
  );
});
