import test from 'tape';
import {
  createNewUnsafeRec,
  createNewUnsafeGlobalForNode,
  createNewUnsafeGlobalForBrowser
} from '../../src/unsafeRec';

const isBrowser = new Function('try {return this===window}catch(e){ return false}')(); // eslint-disable-line no-new-func
const isNode = new Function('try {return this===global}catch(e){ return false}')(); // eslint-disable-line no-new-func

test('createNewUnsafeRec', t => {
  t.plan(7);

  const unsafeRec = createNewUnsafeRec();
  const { unsafeGlobal, sharedGlobalDescs, unsafeEval, unsafeFunction, allShims } = unsafeRec;

  t.ok(Object.isFrozen(unsafeRec));

  // todo: more thorough test of descriptors.
  t.deepEqual(sharedGlobalDescs.Object, {
    value: unsafeGlobal.Object,
    configurable: true,
    writable: true
  });
  t.equal(unsafeEval, unsafeGlobal.eval);
  t.deepEqual(unsafeFunction, unsafeGlobal.Function);
  t.deepEqual(allShims, []);

  t.ok(unsafeGlobal instanceof unsafeGlobal.Object, 'global must be an Object');
  t.notOk(unsafeGlobal instanceof Object, 'must not be Object in this realm');
});

test('createNewUnsafeGlobalForNode on node', t => {
  if (!isNode) {
    t.skip('Skipping, not node');
    t.end();
    return;
  }

  t.plan(6);

  const unsafeGlobal = createNewUnsafeGlobalForNode();

  t.ok(unsafeGlobal instanceof unsafeGlobal.Object, 'global must be an Object');
  t.notOk(unsafeGlobal instanceof Object, 'must not be Object in this realm');

  t.ok(unsafeGlobal.eval instanceof unsafeGlobal.Function, 'must provide eval() function');
  t.notOk(unsafeGlobal.eval instanceof Function, 'eval() must not be Function in this realm');

  t.ok(unsafeGlobal.Function instanceof unsafeGlobal.Function, 'must provide Function() function');
  t.notOk(
    unsafeGlobal.Function instanceof Function,
    'Function() must not be Function in this realm'
  );
});

test('createNewUnsafeGlobalForNode on a browser', t => {
  if (!isBrowser) {
    t.skip('Skipping, not a browser');
    t.end();
    return;
  }

  // todo, implement browser tests
  t.fail('not implemented yet');
});

test('createNewUnsafeGlobalForBrowser on node', t => {
  if (!isNode) {
    t.skip('Skipping, not node');
    t.end();
    return;
  }

  t.plan(3);

  // eslint-disable-next-line global-require
  const vm = require('vm');
  const window = vm.runInNewContext('"use strict"; (0, eval)("this")');
  const iframe = {
    contentWindow: window,
    style: {}
  };
  const body = [];
  global.document = {
    createElement() {
      return iframe;
    },
    body: {
      appendChild(el) {
        body.push(el);
      }
    }
  };

  let unsafeGlobal;
  try {
    global.window = global;
    global.document = document;
    unsafeGlobal = createNewUnsafeGlobalForBrowser();
  } catch (e) {
    throw e;
  } finally {
    // Ensure this cleanup always occurs.
    delete global.window;
    delete global.document;
  }

  t.equal(unsafeGlobal, iframe.contentWindow, 'global must be from iframe');
  t.equal(iframe.style.display, 'none', 'iframe must be hidden');
  t.deepEqual(body, [iframe], 'iframe must be in document body');
});

test('createNewUnsafeGlobalForBrowser on a browser', t => {
  if (!isBrowser) {
    t.skip('Skipping, not a browser');
    t.end();
    return;
  }

  // todo, implement browser tests
  t.fail('not implemented yet');
});
