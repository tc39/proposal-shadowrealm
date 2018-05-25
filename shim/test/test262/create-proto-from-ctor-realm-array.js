import test from 'tape';
import Realm from '../../src/realm';

test('esid: sec-array.prototype.concat', t => {
  t.plan(2);

  const array = [];
  const OArray = new Realm().global.Array;
  let callCount = 0;
  const speciesDesc = {
    get() {
      callCount += 1;
    }
  };

  array.constructor = OArray;

  Object.defineProperty(Array, Symbol.species, speciesDesc);
  Object.defineProperty(OArray, Symbol.species, speciesDesc);

  const result = array.concat();

  t.equal(Object.getPrototypeOf(result), Array.prototype);
  t.equal(callCount, 0, 'Species constructor is not referenced');
});
