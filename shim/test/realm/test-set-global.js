import test from 'tape';
import Realm from '../../src/realm';

test('set globals', t => {
  const r = Realm.makeRootRealm();

  // strict mode should prevent this
  t.throws(() => r.evaluate('evil = 666'), ReferenceError);

  r.global.victim = 3;
  r.evaluate('victim = 666');
  t.equal(r.global.victim, 666);

  t.end();
});
