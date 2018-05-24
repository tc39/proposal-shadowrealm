const Realm = require('../../dist/realm-shim.js');
const test = require('tape');

test('esid: sec-array-exotic-objects-defineownproperty-p-desc', t => {
  t.plan(1);

  const other = new Realm().global;
  const OArray = other.Array;
  const array = new OArray();

  t.throws(() => {
    array.length = 4294967296;
  }, RangeError);
});
