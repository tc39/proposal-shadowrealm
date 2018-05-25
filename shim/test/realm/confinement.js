import test from 'tape';
import Realm from '../../src/realm';

test('confinement evaluation strict mode', t => {
  t.plan(2);

  const r = new Realm();

  t.equal(r.evaluate('(function() { return this })()'), undefined);
  t.equal(r.evaluate('(new Function("return this"))()'), undefined);
});

test('confinement evaluation constructor', t => {
  t.plan(2);

  const r = new Realm();

  t.throws(() => {
    r.evaluate('({}).constructor.constructor("return this")()');
  }, r.global.Error);
  t.throws(() => {
    r.evaluate('Error.__proto__.constructor("return this")()');
  }, r.global.Error);
});

test('confinement evaluation eval', t => {
  t.plan(2);

  const r = new Realm();

  // Strict mode
  t.equal(r.evaluate('(0, eval)("this")'), r.global);
  t.equal(r.evaluate('var evil = eval; evil("this")'), r.global);
});
