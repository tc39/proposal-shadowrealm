import test from 'tape';
import Realm from '../../src/realm';

test('esid: sec-array-constructor-array', t => {
  t.plan(1);

  const other = Realm.makeRootRealm().global;
  const C = new other.Function();
  C.prototype = null;

  const o = Reflect.construct(Array, [], C);

  t.equal(Object.getPrototypeOf(o), other.Array.prototype);
});

test('esid: sec-array.of', t => {
  t.plan(1);

  const other = Realm.makeRootRealm().global;
  const C = new other.Function();
  C.prototype = null;

  const a = Array.from.call(C, []);

  t.equal(Object.getPrototypeOf(a), other.Object.prototype);
});

test('esid: sec-array.of', t => {
  t.plan(1);

  const other = Realm.makeRootRealm().global;
  const C = new other.Function();
  C.prototype = null;

  const a = Array.of.call(C, 1, 2, 3);

  t.equal(Object.getPrototypeOf(a), other.Object.prototype);
});
