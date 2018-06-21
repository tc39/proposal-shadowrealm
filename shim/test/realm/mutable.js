import test from 'tape';
import Realm from '../../src/realm';

test('most Realm globals are mutable', t => {
  t.plan(3);
  const r = Realm.makeRootRealm();

  r.evaluate('decodeURI = function(uri) { return "decoded" }');
  t.equal(r.evaluate('decodeURI("http://example.org/")'), 'decoded');

  r.evaluate('Math.embiggen = function(a) { return a+1 }');
  t.equal(r.evaluate('Math.embiggen(1)'), 2);

  r.evaluate('Realm = function(opts) { this.extra = "extra" }');
  t.equal(r.evaluate('(new Realm({})).extra'), 'extra');
});

test('some Realm globals are immutable', t => {
  t.plan(6);
  const r = Realm.makeRootRealm();

  t.throws(() => r.evaluate('Infinity = 4'), TypeError); // strict mode
  t.equal(r.evaluate('Infinity'), Infinity);

  t.throws(() => r.evaluate('NaN = 4'), TypeError);
  t.notEqual(r.evaluate('NaN'), 4);

  t.throws(() => r.evaluate('undefined = 4'), TypeError);
  t.equal(r.evaluate('undefined'), undefined);
});
