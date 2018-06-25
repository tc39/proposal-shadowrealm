import test from 'tape';
import Realm from '../../src/realm';

test('constructor error should not leak TypeError', t => {
  const r = Realm.makeRootRealm();
  function check() {
    try {
      const r2 = new Realm({ intrinsics: 'bad values cause TypeError' });
      r2.evaluate('1'); // should never reach here
      return false;
    } catch (e) {
      return e;
    }
  }
  r.evaluate(`this.check = ${check};`);
  const e = r.evaluate('check();');
  t.notEqual(e, false, 'new Realm should have failed but did not');
  t.notOk(e instanceof TypeError, "should not be parent's TypeError");
  t.ok(e instanceof r.global.TypeError);

  // we're specifically concerned about this sort of attack: this should
  // modify the child Realm's TypeError.prototype, not ours
  r.evaluate('check().__proto__.i_was_here = 5;');
  t.equal(TypeError.prototype.i_was_here, undefined);
  t.end();
});

test('init() with bad this should not leak TypeError', t => {
  const r = Realm.makeRootRealm();
  function check() {
    const r2 = Realm.makeRootRealm();
    try {
      r2.init.apply(4); // causes TypeError in init(), typeof O !== 'object'
      return false;
    } catch (e) {
      return e;
    }
  }
  r.evaluate(`this.check = ${check};`);
  const e = r.evaluate('check();');
  t.notEqual(e, false, 'new Realm should have failed but did not');
  t.notOk(e instanceof TypeError, "should not be parent's TypeError");
  t.ok(e instanceof r.global.TypeError);
  t.end();
});

test('init() with bad this should not leak TypeError', t => {
  const r = Realm.makeRootRealm();
  function check() {
    const r2 = Realm.makeRootRealm();
    try {
      r2.init.apply({}); // causes TypeError in init(), Realm2RealmRec.has(O)
      return false;
    } catch (e) {
      return e;
    }
  }
  r.evaluate(`this.check = ${check};`);
  const e = r.evaluate('check();');
  t.notEqual(e, false, 'new Realm should have failed but did not');
  t.notOk(e instanceof TypeError, "should not be parent's TypeError");
  t.ok(e instanceof r.global.TypeError);
  t.end();
});

test('eval() with non-parsable string should not leak SyntaxError', t => {
  const r = Realm.makeRootRealm();
  function check() {
    const r2 = Realm.makeRootRealm();
    try {
      r2.evaluate('!$%$%!@#$%!#@$%'); // non-parsable, should cause error
      return false;
    } catch (e) {
      return e;
    }
  }
  r.evaluate(`this.check = ${check};`);
  const e = r.evaluate('check();');
  t.notEqual(e, false, 'new Realm should have failed but did not');
  t.notOk(e instanceof SyntaxError, "should not be parent's SyntaxError");
  t.ok(e instanceof r.global.SyntaxError);
  t.end();
});

test('eval() should yield useful stack trace', t => {
  const r = Realm.makeRootRealm();
  // t.throws() doesn't provide a way to look a e.stack
  function outer8155() {
    r.evaluate('function inner9184() { throw TypeError("yes1773"); } inner9184()');
  }
  try {
    outer8155();
    t.fail('should have thrown');
  } catch (e) {
    t.assert(e instanceof TypeError);
    const stack = e.stack;
    // stack should contain both inner and outer stacks
    t.notEqual(stack.indexOf('outer8155'), -1); // outer
    t.notEqual(stack.indexOf('inner9184'), -1); // inner
  }
  t.end();
});
