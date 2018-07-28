import test from 'tape';
import Realm from '../../src/realm';

test('new Realm', t => {
  t.plan(1);

  t.throws(() => new Realm(), TypeError, 'new Real() should throws');
});
