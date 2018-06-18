import test from 'tape';
import Realm from '../../src/realm';

test('typeof', t => {
  t.throws(() => DEFINITELY_NOT_DEFINED, ReferenceError); // eslint-disable-line
  t.equal(typeof DEFINITELY_NOT_DEFINED, 'undefined'); // eslint-disable-line
  t.equal(typeof 4, 'number');
  t.equal(typeof undefined, 'undefined');
  t.equal(typeof 'a string', 'string');
  t.ok(process);
  t.equal(typeof process, 'object');

  const r = new Realm();
  t.throws(() => r.evaluate('DEFINITELY_NOT_DEFINED'), r.global.ReferenceError);
  t.equal(r.evaluate('typeof DEFINITELY_NOT_DEFINED'), 'undefined');
  t.equal(r.evaluate('typeof 4'), 'number');
  t.equal(r.evaluate('typeof undefined'), 'undefined');
  t.equal(r.evaluate('typeof "a string"'), 'string');
  t.throws(() => r.evaluate('process'), r.global.ReferenceError);
  t.equal(r.evaluate('typeof process'), 'undefined'); // should be censored
  t.end();
});
