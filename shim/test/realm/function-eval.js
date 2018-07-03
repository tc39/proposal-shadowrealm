import test from 'tape';
import Realm from '../../src/realm';

test('function-no-body', t => {
  const r = Realm.makeRootRealm();
  const f1 = new r.global.Function();
  const src = f1.toString();
  t.notOk(src.includes('undefined'));
  t.equal(f1(), undefined);
  t.end();
});

test('function-injection', t => {
  const goodFunc = 'return a+1';
  const r = Realm.makeRootRealm();
  const f1 = new r.global.Function('a', goodFunc);
  t.equal(f1(5), 6);

  // the naive expansion is: '(function(a) {'  +  evilFunc  +  '})'
  // e.g. `(function(a) { ${evilFunc} })`

  // we want to trick that into defining one function and evaluating
  // something else (which is evil)
  // like: '(function(a) {'  +  '}, this.haha = 666, {'  +  '})'
  // which becomes: (function(a) {}, this.haha = 666, {})

  const evilFunc = '}, this.haha = 666, {';
  t.throws(() => new r.global.Function('a', evilFunc), r.global.SyntaxError);
  t.equal(r.global.haha, undefined);

  t.end();
});

test('function-injection-2', t => {
  const r = Realm.makeRootRealm();
  let flag = false;
  r.global.target = function() {
    flag = true;
  };
  function check(...args) {
    t.throws(() => r.global.Function(...args), r.global.SyntaxError, args);
    t.equal(flag, false);
  }
  function checkNotError(...args) {
    r.global.Function(...args);
    t.equal(flag, false);
  }

  // test cases from https://code.google.com/archive/p/google-caja/issues/1616
  check(`}), target(), (function(){`);
  check(`})); }); target(); (function(){ ((function(){ `);

  // and from https://bugs.chromium.org/p/v8/issues/detail?id=2470
  check('/*', '*/){');
  check('', '});(function(){');
  checkNotError('//', '//');
  check('', `});print('1+1=' + (1+1));(function(){`);

  // and from https://bugs.webkit.org/show_bug.cgi?id=106160
  check('){});(function(', '');
  check('', '});(function(){');
  checkNotError('//', '//');
  check('/*', '*/){');
  check('}}; 1 * {a:{');

  t.end();
});

test('function-reject-paren-default', t => {
  // this ought to be accepted, but our shim is conservative about parenthesis
  const r = Realm.makeRootRealm();
  const goodFunc = 'return foo';
  t.throws(() => new r.global.Function('foo, a = new Date(0)', goodFunc), r.global.SyntaxError);
  t.end();
});

test('function-default-parameters', t => {
  const goodFunc = 'return a+1';
  const r = Realm.makeRootRealm();
  const f1 = new r.global.Function('a=1', goodFunc);
  t.equal(f1(), 2);
  t.end();
});

test('function-rest-parameters', t => {
  const goodFunc = 'return rest[0] + rest[1]';
  const r = Realm.makeRootRealm();
  const f1 = new r.global.Function('...rest', goodFunc);
  t.equal(f1(1, 2), 3);
  t.end();
});

test('function-destructuring-parameters', t => {
  const goodFunc = 'return foo + bar + baz';
  const r = Realm.makeRootRealm();
  const f1 = new r.global.Function('{foo, bar}, baz', goodFunc);
  t.equal(f1({ foo: 1, bar: 2 }, 3), 6);
  t.end();
});

test('function-legitimate-but-weird-parameters', t => {
  const r = Realm.makeRootRealm();
  const goodFunc = 'return foo + bar + baz';
  const f1 = new r.global.Function('foo, bar', 'baz', goodFunc);
  t.equal(f1(1, 2, 3), 6);

  const goodFunc2 = 'return foo + bar[0] + bar[1]';
  const f2 = new r.global.Function('foo, bar = [1', '2]', goodFunc2);
  t.equal(f2(1), 4);

  t.end();
});

test('frozen-eval', t => {
  const r = Realm.makeRootRealm();

  const desc = Object.getOwnPropertyDescriptor(r.global, 'eval');
  desc.writable = false;
  desc.configurable = false;
  Object.defineProperty(r.global, 'eval', desc);

  t.equal(r.evaluate('eval(1)'), 1);

  t.end();
});
