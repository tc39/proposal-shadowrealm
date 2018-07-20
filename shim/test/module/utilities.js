import test from 'tape';
import sinon from 'sinon';
import { throwTantrum, assert, cleanupSource } from '../../src/utilities';

/* eslint-disable no-console */

test('throwTantrum', t => {
  t.plan(3);

  sinon.stub(console, 'error').callsFake();

  t.throws(() => throwTantrum('foo'), /^please report internal shim error: foo$/);

  t.equals(console.error.callCount, 1);
  t.equals(console.error.getCall(0).args[0], 'please report internal shim error: foo');

  console.error.restore();
});

test('throwTantrum', t => {
  t.plan(5);

  sinon.stub(console, 'error');

  t.throws(() => throwTantrum('foo', new Error('bar')), /^please report internal shim error: foo$/);

  t.equals(console.error.callCount, 3);
  t.equals(console.error.getCall(0).args[0], 'please report internal shim error: foo');
  t.equals(console.error.getCall(1).args[0], 'Error: bar');
  t.ok(console.error.getCall(2).args[0].includes('at t.throws'));

  console.error.restore();
});

test('assert', t => {
  t.plan(4);

  sinon.stub(console, 'error').callsFake();

  t.doesNotThrow(() => assert(true, 'foo'));
  t.throws(() => assert(false, 'foo'), /^please report internal shim error: foo$/);

  t.equals(console.error.callCount, 1);
  t.equals(console.error.getCall(0).args[0], 'please report internal shim error: foo');

  console.error.restore();
});

test('cleanupSource', t => {
  t.plan(2);

  t.equals(
    cleanupSource(`function() { cov_2kmyol0g2w[0]++;return true; }`),
    'function() { return true; }'
  );
  t.equals(
    cleanupSource(`function() { return (0, _123)('true'); }`),
    `function() { return (0, eval)('true'); }`
  );
});
