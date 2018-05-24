const Realm = require('../../dist/realm-shim.js');
const test = require('tape');

test('esid: sec-performeval', t => {
  t.plan(1);

  const other = new Realm().global;
  const otherEval = other.eval;

  otherEval('var x = 23;');
  t.equal(typeof x, 'undefined');
  // t.equal(other.x, 23); // not supported
});
