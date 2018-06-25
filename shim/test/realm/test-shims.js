import test from 'tape';
import Realm from '../../src/realm';

test('shims: no options', t => {
  Realm.makeRootRealm();
  t.end();
});

test('shims: empty options', t => {
  Realm.makeRootRealm({});
  t.end();
});

test('shims: no shims', t => {
  Realm.makeRootRealm({ shims: [] });
  t.end();
});

function addKilroy(global) {
  global.kilroy = 'was here';
}
const shim1 = `${addKilroy} addKilroy(this)`;
const shim2 = `this.kilroy += ' but he left';`;

test('shims: one shim', t => {
  const r = Realm.makeRootRealm({ shims: [shim1] });
  t.equal(r.global.kilroy, 'was here');
  t.end();
});

test('shims: two shims', t => {
  const r = Realm.makeRootRealm({ shims: [shim1, shim2] });
  t.equal(r.global.kilroy, 'was here but he left');
  t.end();
});

test('shims: inherited shims', t => {
  const r1 = Realm.makeRootRealm({ shims: [shim1] });
  const r2 = r1.evaluate(`Realm.makeRootRealm({shims: [${JSON.stringify(shim2)}]})`);
  t.equal(r1.global.kilroy, 'was here');
  t.equal(r2.global.kilroy, 'was here but he left');

  const r3root = r2.evaluate(`Realm.makeRootRealm()`);
  t.equal(r3root.global.kilroy, 'was here but he left');

  // compartments have their own global, so they don't take shims
  const r3compartment = r2.evaluate(`Realm.makeCompartment()`);
  t.equal(r3compartment.global.kilroy, undefined);

  // but a new RootRealm *under* that compartment *should* get the shims of
  // the nearest enclosing RootRealm
  const r4 = r3compartment.evaluate(`Realm.makeRootRealm()`);
  t.equal(r4.global.kilroy, 'was here but he left');

  t.end();
});
