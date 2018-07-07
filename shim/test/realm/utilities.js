import test from 'tape';
import { throwTantrum, assert } from '../../src/utilities';

test('throwTantrum', t => {
  t.plan(1);

  t.throws(() => throwTantrum('foo'), /^please report internal shim error: foo$/);
});

test('assert', t => {
  t.plan(2);

  t.doesNotThrow(() => assert(true, 'foo'));
  t.throws(() => assert(false, 'foo'), /^please report internal shim error: failed to: foo$/);
});
