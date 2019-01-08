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

  // test cases from https://code.google.com/archive/p/google-caja/issues/1616
  check(`}), target(), (function(){`);
  check(`})); }); target(); (function(){ ((function(){ `);

  // and from https://bugs.chromium.org/p/v8/issues/detail?id=2470
  check('/*', '*/){');
  check('', '});(function(){');
  check('//', '//'); // we reject these even though that bug allows them
  check('', `});print('1+1=' + (1+1));(function(){`);

  // and from https://bugs.webkit.org/show_bug.cgi?id=106160
  check('){});(function(', '');
  check('', '});(function(){');
  check('//', '//'); // we reject these even though that bug allows them
  check('/*', '*/){');
  check('}}; 1 * {a:{');

  // bug from Matt Austin: this is surprising but doesn't allow new access
  check('arg=`', '/*body`){});({x: this/**/');
  // a naive evaluation might do this:
  //     (function(arg=`){
  //      /*body`){});({x: this/**/
  //     })

  // In which the backtick in arg= eats both the )} that we add and the /*
  // that the body adds, allowing the body to terminate the function
  // definition. Then the body defines a new expression, which creates an
  // object with a property named "x" which captures the same 'this' you
  // could have gotten with plain safe eval().

  // markm tried to protect against this by injecting an extra trailing
  // block comment to the end of the arguments, creating a body like this

  //     (function(arg=`
  //     /*``*/){
  //      /*body`){});({x: this/**/
  //     })

  // In this version, the backtick from arg= eats the first part of the
  // injected block comment, and the backtick from the body matches the
  // second part of the injected block comment. That yields a
  // syntactically-valid but semantically-invalid default argument with a
  // value of `\n/*``*/){\n/*body` , in which the first template literal
  // (`\n/*`) evaluates to a string ("\n/*") which is then used as the
  // template-literal-tag for the second template literal. This is
  // semantically invalid because strings cannot be called as functions, but
  // the syntax is still valid. The constructed function is bypassed, so its
  // default argument is never evaluated, so this invalidity doesn't matter.

  // To protect against this, we'll just forbid everything except simple
  // identifiers in Function constructor calls: no default arguments ("=")
  // and no pattern matching expressions ("[a,b]"). You can still use complex
  // arguments in function definitions, just not in calls to the Function
  // constructor.

  t.end();
});

test('function-reject-paren-default', t => {
  // this ought to be accepted, but our shim is conservative about parenthesis
  const r = Realm.makeRootRealm();
  const goodFunc = 'return foo';
  t.throws(() => new r.global.Function('foo, a = new Date(0)', goodFunc), r.global.SyntaxError);
  t.end();
});

// our shim is conservative about parameters: we only accept simple
// identifiers; no default arguments, no pattern matching, no ...rest
// parameters
test('function-default-parameters', t => {
  const goodFunc = 'return a+1';
  const r = Realm.makeRootRealm();
  t.throws(() => new r.global.Function('a=1', goodFunc), r.global.SyntaxError);
  t.end();
});

test('function-rest-parameters', t => {
  const goodFunc = 'return rest[0] + rest[1]';
  const r = Realm.makeRootRealm();
  t.throws(() => new r.global.Function('...rest', goodFunc), r.global.SyntaxError);
  t.end();
});

test('function-destructuring-parameters', t => {
  const goodFunc = 'return foo + bar + baz';
  const r = Realm.makeRootRealm();
  t.throws(() => new r.global.Function('{foo, bar}, baz', goodFunc), r.global.SyntaxError);
  t.end();
});

test('function-legitimate-but-weird-parameters', t => {
  const r = Realm.makeRootRealm();
  const goodFunc = 'return foo + bar + baz';
  const f1 = new r.global.Function('foo, bar', 'baz', goodFunc);
  t.equal(f1(1, 2, 3), 6);

  const goodFunc2 = 'return foo + bar[0] + bar[1]';
  t.throws(() => new r.global.Function('foo, bar = [1', '2]', goodFunc2), r.global.SyntaxError);

  t.end();
});

test('degenerate-pattern-match-argument', t => {
  const r = Realm.makeRootRealm();
  const goodFunc = 'return foo + bar + baz';
  // this syntax is rejected by the normal JS parser, not by anything special
  // about Realms
  t.throws(() => new r.global.Function('3', goodFunc), r.global.SyntaxError);

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
