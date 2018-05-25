import test from 'tape';
import Realm from '../../src/realm';

test('esid: sec-array-exotic-objects-defineownproperty-p-desc', t => {
  t.plan(1);

  const other = new Realm().global;
  const OArray = other.Array;
  const array = new OArray();

  t.throws(() => {
    array.length = 4294967296;
  }, RangeError);
});
