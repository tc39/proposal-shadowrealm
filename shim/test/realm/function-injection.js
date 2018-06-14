import test from 'tape';
import Realm from '../../src/realm';

test('function-injection', t => {
  const goodFunc = 'return a+1';
  const r = new Realm();
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
