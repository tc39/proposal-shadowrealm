import test from 'tape';
import vm from 'vm';
import Realm from '../../src/realm';
// import { walkObjects } from '../../src/scan';

export const protectedObjects = new WeakMap();
// todo: build this by walking Object or 'this' or something
protectedObjects.set(Function, 'Function');
protectedObjects.set(Function.prototype, 'Function.prototype');
protectedObjects.set(eval, 'eval');
protectedObjects.set((0, eval)('this'), 'global object');

test('eval.toString', t => {
  const r = Realm.makeRootRealm();
  const p = r.evaluate('Object.prototype.__lookupGetter__.__proto__');
  t.equal(p, r.global.Function.prototype);
  t.notEqual(p, Function.prototype);
  t.end();
});

function testForBug(o) {
  // on a fixed platform, this should throw
  // eslint-disable-next-line no-restricted-properties, no-underscore-dangle
  (0, o.prototype.__defineGetter__)('x', () => {});
}

test('fix the bug in which accessor methods leak the global', t => {
  const unfixedGlobal = vm.runInNewContext('"use strict"; (0, eval)("this")');
  try {
    testForBug(unfixedGlobal.Object);
    // eslint-disable-next-line no-console
    console.log('this platform has the bug');
  } catch (e) {
    if (e instanceof unfixedGlobal.TypeError) {
      // eslint-disable-next-line no-console
      console.log('this platform does not have the bug');
    } else {
      throw e; // some other problem
    }
  }

  // first test that the primal realm was fixed: either as a side-effect of
  // creating the Realm shim, or because it wasn't buggy in the first place
  t.throws(() => testForBug(Object), TypeError);

  // now test that the bug is fixed inside a new RootRealm too
  const r = Realm.makeRootRealm();
  t.throws(() => testForBug(r.global.Object), r.global.TypeError);

  // and the fix we applied should not leak the unsafe Function
  const p = r.evaluate('Object.prototype.__lookupGetter__.__proto__');
  t.equal(p, r.global.Function.prototype);
  t.notEqual(p, Function.prototype);
  t.end();
});

function getGenerator() {
  function* aStrictGenerator() {
    yield;
  }
  return Object.getPrototypeOf(aStrictGenerator);
}

test('strict-function', t => {
  const r = Realm.makeRootRealm();
  const c = r.evaluate('Function.prototype.constructor');
  t.notOk('arguments' in Object.getOwnPropertyDescriptors(c));
  t.notOk('caller' in Object.getOwnPropertyDescriptors(c));
  t.end();
});

test('generator-constructor-is-consistent', t => {
  const r = Realm.makeRootRealm();
  const c = r.evaluate('Function.prototype.constructor');
  const gp = r.evaluate(`(${getGenerator})`)();
  const gpc = gp.constructor;
  t.equal(Object.getPrototypeOf(gpc), c);
  t.end();
});

// todo: rewrite and re-enable

test('scan', t => {
  /*
  const r = Realm.makeRootRealm();
  let failures = [];

  const primalObjects = walkObjects((0, eval)('this'), () => {});
  function check(obj, pathForObject) {
    //if (protectedObjects.has(obj)) {
    //  failures.push(`object ${protectedObjects.get(obj)} shouldn't be available as ${pathForObject(obj)}`);
    //}
    if (primalObjects.has(obj)) {
      failures.push(
        `primal object ${primalObjects.get(obj)} shouldn't be available in Realm as ${pathForObject(
          obj
        )}`
      );
    }
  }
  */
  /*
  const hideme = {};
  r.evaluate('(a) => {this.a = a}')(hideme);
  */

  /*
  const realmObjects = walkObjects(r.global, check);
  //r.evaluate('this.a = {}');
  //const bad = r.evaluate('this.a.__proto__.__defineGetter__.__proto__');
  //t.notEqual(bad, Function.prototype);

  walkObjects(r.global, check);
  if (failures.length) {
    console.log('failures:');
    for (let f of failures) {
      console.log(f);
    }
    t.fail();
  }
  */
  t.end();
});

test('scan2', t => {
  /*
  const r = Realm.makeRootRealm();
  let failures = [];

  // to make this test runnable, modify Realm.constructor to add these lines
  // at the end:
  // this.UNSAFEREC = unsafeRec; // todo delete this
  // this.REALMREC = realmRec;

  const unsafeRecObjects = new Map();
  unsafeRecObjects.set(r.UNSAFEREC.unsafeGlobal, 'unsafeGlobal');
  unsafeRecObjects.set(r.UNSAFEREC.unsafeEval, 'unsafeEval');
  unsafeRecObjects.set(r.UNSAFEREC.unsafeFunction, 'unsafeFunction');

  function check(obj, pathForObject) {
    //if (protectedObjects.has(obj)) {
    //  failures.push(`object ${protectedObjects.get(obj)} shouldn't be available as ${pathForObject(obj)}`);
    //}
    if (unsafeRecObjects.has(obj)) {
      failures.push(
        `unsafeRec object ${unsafeRecObjects.get(
          obj
        )} shouldn't be available in Realm as ${pathForObject(obj)}`
      );
    }
  }

  const safeRecObjects = walkObjects(r.REALMREC, check);

  if (failures.length) {
    console.log('failures:');
    for (let f of failures) {
      console.log(f);
    }
    t.fail();
  }
  */
  t.end();
});
