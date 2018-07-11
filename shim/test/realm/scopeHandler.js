import test from 'tape';
import sinon from 'sinon';
import { createScopeHandler } from '../../src/scopeHandler';

test('scope hander traps', t => {
  t.plan(13);

  sinon.stub(console, 'error').callsFake();

  const handler = createScopeHandler({});

  ['has', 'get', 'set'].forEach(trap => t.doesNotThrow(() => handler[trap]));

  [
    'apply',
    'construct',
    'defineProperty',
    'delteProperty',
    'getOwnProperty',
    'getPrototypeOf',
    'isExtensible',
    'ownKeys',
    'preventExtensions',
    'setPrototypeOf'
  ].forEach(trap => t.throws(() => handler[trap]), /unexpected scope handler trap called/);

  // eslint-disable-next-line no-console
  console.error.restore();
});

test('scope hander has', t => {
  t.plan(9);

  const unsafeGlobal = { foo: {} };
  const handler = createScopeHandler({ unsafeGlobal });
  const target = { bar: {} };

  t.equal(handler.has(target, 'eval'), true);
  handler.allowUnsafeEvaluatorOnce();
  t.equal(handler.has(target, 'eval'), true);
  handler.get(target, 'eval'); // trigger the revoke
  t.equal(handler.has(target, 'eval'), true);
  t.equal(handler.has(target, 'eval'), true); // repeat

  t.equal(handler.has(target, Symbol.unscopables), false);

  t.equal(handler.has(target, 'arguments'), false);
  t.equal(handler.has(target, 'foo'), true);
  t.equal(handler.has(target, 'bar'), true);
  t.equal(handler.has(target, 'dummy'), false);
});

test('scope hander get', t => {
  t.plan(13);

  const unsafeGlobal = { foo: {} };
  const unsafeEval = {};
  const handler = createScopeHandler({ unsafeGlobal, unsafeEval });
  const safeGlobal = { eval: {}, bar: {} };
  const target = Object.create(safeGlobal);

  t.equal(handler.unsafeEvaluatorAllowed(), false); // initial
  t.equal(handler.get(target, 'eval'), target.eval);

  handler.allowUnsafeEvaluatorOnce();
  t.equal(handler.unsafeEvaluatorAllowed(), true);
  t.equal(handler.get(target, 'eval'), unsafeEval);
  t.equal(handler.unsafeEvaluatorAllowed(), false);
  t.equal(handler.get(target, 'eval'), target.eval);
  t.equal(handler.unsafeEvaluatorAllowed(), false);
  t.equal(handler.get(target, 'eval'), target.eval); // repeat

  t.equal(handler.get(target, Symbol.unscopables), undefined);

  t.equal(handler.get(target, 'arguments'), undefined);
  t.equal(handler.get(target, 'foo'), undefined);
  t.equal(handler.get(target, 'bar'), target.bar);
  t.equal(handler.get(target, 'dummy'), undefined);
});

test('scope hander et', t => {
  t.plan(4);

  const unsafeGlobal = {};
  const handler = createScopeHandler({ unsafeGlobal });
  const safeGlobal = { bar: {} };
  const endowments = { foo: {} };
  const target = Object.create(safeGlobal, Object.getOwnPropertyDescriptors(endowments));

  const evil = {};
  handler.set(target, 'eval', evil);
  t.equal(safeGlobal.eval, evil);

  const bar = {};
  handler.set(target, 'bar', bar);
  t.equal(safeGlobal.bar, bar);

  const foo = {};
  t.throws(() => handler.set(target, 'foo', foo), /do not modify endowments like foo/);

  t.equal(Object.keys(unsafeGlobal).length, 0);
});
