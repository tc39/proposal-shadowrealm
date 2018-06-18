import test from 'tape';
import Realm from '../../src/realm';

test('typeof', t => {
  t.throws(() => DEFINITELY_NOT_DEFINED, ReferenceError); // eslint-disable-line
  t.equal(typeof DEFINITELY_NOT_DEFINED, 'undefined'); // eslint-disable-line
  t.equal(typeof 4, 'number');
  t.equal(typeof undefined, 'undefined');
  t.equal(typeof 'a string', 'string');
  t.ok(console);
  t.equal(typeof console, 'object');

  const r = new Realm();
  t.throws(() => r.evaluate('DEFINITELY_NOT_DEFINED'), r.global.ReferenceError);
  t.equal(r.evaluate('typeof DEFINITELY_NOT_DEFINED'), 'undefined');
  t.equal(r.evaluate('typeof 4'), 'number');
  t.equal(r.evaluate('typeof undefined'), 'undefined');
  t.equal(r.evaluate('typeof "a string"'), 'string');
  // todo: the Realm currently censors objects from the unsafe global, but
  // they appear 'undefined' rather than throwing a ReferenceError
  // t.throws(() => r.evaluate('console'), r.global.ReferenceError);
  t.equal(r.evaluate('console'), undefined); // should be censored
  t.equal(r.evaluate('typeof console'), 'undefined'); // should be censored
  t.end();
});
