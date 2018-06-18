import test from 'tape';
import Realm from '../../src/realm';

test('esid: sec-performeval', t => {
  t.plan(1);

  const other = Realm.makeRootRealm().global;
  const otherEval = other.eval;

  otherEval('var x = 23;');
  t.equal(typeof x, 'undefined');
  // t.equal(other.x, 23); // not supported
});
