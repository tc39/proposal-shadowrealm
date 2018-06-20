import test from 'tape';
import Realm from '../../src/realm';
import { walkObjects } from '../../src/scan';

export const protectedObjects = new WeakMap();
// todo: build this by walking Object or 'this' or something
protectedObjects.set(Function, 'Function');
protectedObjects.set(Function.prototype, 'Function.prototype');
protectedObjects.set(eval, 'eval');
protectedObjects.set((0, eval)('this'), 'global object');

test('eval.toString', t => {
  const r = Realm.makeRootRealm();
  t.end(); return;

  const p = r.evaluate('Object.prototype.__lookupGetter__.__proto__');
  t.equal(p, r.global.Function.prototype); // should be
  t.notEqual(p, Function.prototype);
  t.end();
});

test('scan', t => {
  t.end(); return;
  const r = Realm.makeRootRealm();
  let failures = [];

  const primalObjects = walkObjects((0, eval)('this'), () => {});
  function check(obj, pathForObject) {
    //if (protectedObjects.has(obj)) {
    //  failures.push(`object ${protectedObjects.get(obj)} shouldn't be available as ${pathForObject(obj)}`);
    //}
    if (primalObjects.has(obj)) {
      failures.push(`primal object ${primalObjects.get(obj)} shouldn't be available in Realm as ${pathForObject(obj)}`);
    }
  }

  /*
  const hideme = {};
  r.evaluate('(a) => {this.a = a}')(hideme); */

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

  t.end();
});

function thing() {
}

test('scan2', t => {
  t.end(); return;
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
      failures.push(`unsafeRec object ${unsafeRecObjects.get(obj)} shouldn't be available in Realm as ${pathForObject(obj)}`);
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

  t.end();
});
