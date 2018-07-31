import test from 'tape';
import { repairFunctions } from '../../src/repair/functions';

test('repairFunctions', specs => {
  repairFunctions();

  specs.test('Function.prototype.constructor', t => {
    t.plan(4);

    // eslint-disable-next-line no-new-func
    t.doesNotThrow(() => Function(''));

    // eslint-disable-next-line no-proto
    t.throws(() => Error.__proto__.constructor(''), TypeError);
    t.throws(() => Function.prototype.constructor(''), TypeError);

    const proto = Object.getPrototypeOf((0, eval)('(function() {})'));
    t.throws(() => proto.constructor(''), TypeError);
  });

  specs.test('AsyncFunction.constructor', t => {
    t.plan(1);

    try {
      const proto = Object.getPrototypeOf((0, eval)('(async function() {})'));
      t.throws(() => proto.constructor(''), TypeError);
    } catch (e) {
      if (e instanceof SyntaxError && e.message.startsWith('Unexpected token')) {
        t.pass('not supported');
      } else {
        throw e;
      }
    }
  });

  specs.test('GeneratorFunction.constructor', t => {
    t.plan(1);

    try {
      const proto = Object.getPrototypeOf((0, eval)('(function* () {})'));
      t.throws(() => proto.constructor(''), TypeError);
    } catch (e) {
      if (e instanceof SyntaxError && e.message.startsWith('Unexpected token')) {
        t.pass('not supported');
      } else {
        throw e;
      }
    }
  });

  specs.test('AsyncGeneratorFunction.constructor', t => {
    t.plan(1);

    try {
      const proto = Object.getPrototypeOf((0, eval)('(async function* () {})'));
      t.throws(() => proto.constructor(''), TypeError);
    } catch (e) {
      if (e instanceof SyntaxError && e.message.startsWith('Unexpected token')) {
        t.pass('not supported');
      } else {
        throw e;
      }
    }
  });
});
