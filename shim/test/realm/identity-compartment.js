import test from 'tape';
import Realm from '../../src/realm';

// JSON is an ordinary intrinsic
test('identity JSON', t => {
  t.plan(4);

  const r1 = new Realm();
  const r2 = new r1.global.Realm({ intrinsics: 'inherit' });

  t.equal(r2.evaluate('JSON'), r2.evaluate('JSON'));
  t.equal(r2.evaluate('JSON'), r2.evaluate('eval("JSON")'));
  t.notEqual(r2.evaluate('JSON'), JSON);
  t.equal(r2.evaluate('JSON'), r1.evaluate('JSON'));
});

// Realm is a facade root-realm-specific
test('identity Realm', t => {
  t.plan(8);

  const r1 = new Realm();
  const r2 = new r1.global.Realm({ intrinsics: 'inherit' });

  t.ok(r2.evaluate('Realm instanceof Function'));
  t.ok(r2.evaluate('Realm instanceof Object'));
  t.ok(r2.evaluate('Realm') instanceof r1.evaluate('Function'));
  t.ok(r2.evaluate('Realm') instanceof r1.evaluate('Object'));
  t.notOk(r2.evaluate('Realm') instanceof Function);
  t.notOk(r2.evaluate('Realm') instanceof Object);
  t.equal(r2.evaluate('Realm'), r1.evaluate('Realm'));
  t.notEqual(r2.evaluate('Realm'), Realm);
});

// eval is realm-specific
test('identity eval', t => {
  t.plan(8);

  const r1 = new Realm();
  const r2 = new r1.global.Realm({ intrinsics: 'inherit' });

  t.ok(r2.evaluate('eval instanceof Function'));
  t.ok(r2.evaluate('eval instanceof Object'));
  t.ok(r2.evaluate('eval') instanceof r1.evaluate('Function'));
  t.ok(r2.evaluate('eval') instanceof r1.evaluate('Object'));
  t.notOk(r2.evaluate('eval') instanceof Function);
  t.notOk(r2.evaluate('eval') instanceof Object);
  t.notEqual(r2.evaluate('eval'), r1.evaluate('eval'));
  t.notEqual(r2.evaluate('eval'), eval);
});

// Function is realm-specific
test('identity Function', t => {
  t.plan(8);

  const r1 = new Realm();
  const r2 = new r1.global.Realm({ intrinsics: 'inherit' });

  t.ok(r2.evaluate('Function instanceof Function'));
  t.ok(r2.evaluate('Function instanceof Object'));
  t.ok(r2.evaluate('Function') instanceof r1.evaluate('Function'));
  t.ok(r2.evaluate('Function') instanceof r1.evaluate('Object'));
  t.notOk(r2.evaluate('Function') instanceof Function);
  t.notOk(r2.evaluate('Function') instanceof Object);
  t.notEqual(r2.evaluate('Function'), r1.evaluate('Function'));
  t.notEqual(r2.evaluate('Function'), Function);
});
