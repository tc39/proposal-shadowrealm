import test from 'tape';
import sinon from 'sinon';
import { buildChildRealm, createRealmFacade } from '../../src/realmFacade';

const BaseRealm = {
  initRootRealm: () => undefined,
  initCompartment: () => undefined,
  getRealmGlobal: () => undefined,
  realmEvaluate: () => undefined
};

test('buildChildRealm - Realm callAndWrapError() invoked', t => {
  t.plan(2);

  sinon.stub(BaseRealm, 'initRootRealm').callsFake(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'initRootRealm';
  });
  sinon.stub(BaseRealm, 'initCompartment').callsFake(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'initCompartment';
  });

  const Realm = buildChildRealm(BaseRealm);

  t.throws(() => Realm.makeRootRealm(), /initRootRealm/);
  t.throws(() => Realm.makeCompartment(), /initCompartment/);

  BaseRealm.initRootRealm.restore();
  BaseRealm.initCompartment.restore();
});

test('buildChildRealm - callAndWrapError() invoked', t => {
  t.plan(2);

  sinon.stub(BaseRealm, 'getRealmGlobal').callsFake(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'getGlobal';
  });
  sinon.stub(BaseRealm, 'realmEvaluate').callsFake(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'evaluate';
  });

  const Realm = buildChildRealm(BaseRealm);
  const rootRealm = Realm.makeRootRealm();

  t.throws(() => rootRealm.global, /getGlobal/);
  t.throws(() => rootRealm.evaluate(), /evaluate/);

  BaseRealm.getRealmGlobal.restore();
  BaseRealm.realmEvaluate.restore();
});

test('buildChildRealm - callAndWrapError() error types', t => {
  t.plan(7);

  let error;
  sinon.stub(BaseRealm, 'initRootRealm').callsFake(() => {
    throw error;
  });

  const Realm = buildChildRealm(BaseRealm);
  t.throws(() => {
    error = '123';
    Realm.makeRootRealm();
  }, /123/);

  [EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError].forEach(
    ErrorConstructor => {
      t.throws(() => {
        error = new ErrorConstructor();
        Realm.makeRootRealm();
      }, ErrorConstructor);
    }
  );

  BaseRealm.initRootRealm.restore();
});

test('buildChildRealm - callAndWrapError() error throws', t => {
  t.plan(1);

  sinon.stub(BaseRealm, 'initRootRealm').callsFake(() => {
    // eslint-disable-next-line no-throw-literal
    throw {
      get name() {
        throw new TypeError();
      }
    };
  });

  const Realm = buildChildRealm(BaseRealm);
  t.throws(() => Realm.makeRootRealm(), /unknown error/);

  BaseRealm.initRootRealm.restore();
});

test('buildChildRealm - callAndWrapError() unknown error type', t => {
  t.plan(1);

  sinon.stub(BaseRealm, 'initRootRealm').callsFake(() => {
    // eslint-disable-next-line no-throw-literal
    throw {
      name: 'foo',
      message: 'bar'
    };
  });

  const Realm = buildChildRealm(BaseRealm);
  t.throws(() => Realm.makeRootRealm(), Error);

  BaseRealm.initRootRealm.restore();
});

test('buildChildRealm - toString()', t => {
  t.plan(2);

  const Realm = buildChildRealm(BaseRealm);
  const rootRealm = Realm.makeRootRealm();

  t.equals(Realm.toString(), 'function Realm() { [shim code] }');
  t.equals(rootRealm.toString(), '[object Realm]');
});

test('buildChildRealm - Realm.makeRootRealm', t => {
  t.plan(5);

  sinon.spy(BaseRealm, 'initRootRealm');

  const Realm = buildChildRealm(BaseRealm);
  const options = {};
  Realm.makeRootRealm(options);

  t.equals(BaseRealm.initRootRealm.callCount, 1);

  const args = BaseRealm.initRootRealm.getCall(0).args;
  t.equals(args.length, 3);
  t.equals(args[0], Realm);
  t.ok(args[1] instanceof Realm);
  t.equals(args[2], options);

  BaseRealm.initRootRealm.restore();
});

test('buildChildRealm - Realm.makeCompartment', t => {
  t.plan(4);

  sinon.spy(BaseRealm, 'initCompartment');

  const Realm = buildChildRealm(BaseRealm);
  Realm.makeCompartment();

  t.equals(BaseRealm.initCompartment.callCount, 1);

  const args = BaseRealm.initCompartment.getCall(0).args;
  t.equals(args.length, 2);
  t.equals(args[0], Realm);
  t.ok(args[1] instanceof Realm);

  BaseRealm.initCompartment.restore();
});

test('buildChildRealm - realm.global', t => {
  t.plan(4);

  const expectedGlobal = {};
  sinon.stub(BaseRealm, 'getRealmGlobal').callsFake(() => expectedGlobal);

  const Realm = buildChildRealm(BaseRealm);
  const compartment = Realm.makeCompartment();
  const actualGlobal = compartment.global;

  t.equals(BaseRealm.getRealmGlobal.callCount, 1);

  const args = BaseRealm.getRealmGlobal.getCall(0).args;
  t.equals(args.length, 1);
  t.ok(args[0] instanceof Realm);
  t.equals(actualGlobal, expectedGlobal);

  BaseRealm.getRealmGlobal.restore();
});

test('buildChildRealm - realm.evaluate', t => {
  t.plan(6);

  const expectedResult = 123;
  sinon.stub(BaseRealm, 'realmEvaluate').callsFake(() => expectedResult);

  const source = 'abc';
  const endowments = {};
  const Realm = buildChildRealm(BaseRealm);
  const compartment = Realm.makeCompartment();
  const actualResult = compartment.evaluate(source, endowments);

  t.equals(BaseRealm.realmEvaluate.callCount, 1);

  const args = BaseRealm.realmEvaluate.getCall(0).args;
  t.equals(args.length, 3);
  t.ok(args[0] instanceof Realm);
  t.equals(args[1], source);
  t.equals(args[2], endowments);

  t.equals(actualResult, expectedResult);

  BaseRealm.realmEvaluate.restore();
});

test('createRealmFacade', t => {
  t.plan(5);

  // The child realm was tested above, here we only
  // check that the facade works as expected.

  sinon.spy(BaseRealm, 'initRootRealm');
  sinon.spy(BaseRealm, 'initCompartment');
  sinon.spy(BaseRealm, 'getRealmGlobal');
  sinon.spy(BaseRealm, 'realmEvaluate');

  const unsafeRec = { unsafeEval: eval };
  sinon.spy(unsafeRec, 'unsafeEval');

  const Realm = createRealmFacade(unsafeRec, BaseRealm);
  const rootRealm = Realm.makeRootRealm();
  rootRealm.global; // eslint-disable-line no-unused-expressions
  rootRealm.evaluate();
  const compartment = Realm.makeCompartment();
  compartment.global; // eslint-disable-line no-unused-expressions
  compartment.evaluate();

  t.equals(unsafeRec.unsafeEval.callCount, 1);

  t.equals(BaseRealm.initRootRealm.callCount, 1);
  t.equals(BaseRealm.initCompartment.callCount, 1);
  t.equals(BaseRealm.getRealmGlobal.callCount, 2);
  t.equals(BaseRealm.realmEvaluate.callCount, 2);

  BaseRealm.initRootRealm.restore();
  BaseRealm.initCompartment.restore();
  BaseRealm.getRealmGlobal.restore();
  BaseRealm.realmEvaluate.restore();
});
