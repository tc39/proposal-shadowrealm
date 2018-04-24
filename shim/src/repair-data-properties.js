import { defineProperty, getOwnPropertyDescriptor, objectHasOwnProperty } from '../utils/commons';

/**
 * For a special set of properties (defined below), it ensures that the
 * effect of freezing does not suppress the ability to override these
 * properties on derived objects by simple assignment.
 *
 * Because of lack of sufficient foresight at the time, ES5 unfortunately
 * specified that a simple assignment to a non-existent property must fail if
 * it would override a non-writable data property of the same name. (In
 * retrospect, this was a mistake, but it is now too late and we must live
 * with the consequences.) As a result, simply freezing an object to make it
 * tamper proof has the unfortunate side effect of breaking previously correct
 * code that is considered to have followed JS best practices, if this
 * previous code used assignment to override.
 *
 * To work around this mistake, deepFreeze(), prior to freezing, replaces
 * selected configurable own data properties with accessor properties which
 * simulate what we should have specified -- that assignments to derived
 * objects succeed if otherwise possible.
 */

function tamperProof(obj, prop) {
  const desc = getOwnPropertyDescriptor(obj, prop);
  if ('value' in desc && desc.configurable) {
    const value = desc.value;

    // eslint-disable-next-line no-inner-declarations
    function getter() {
      return value;
    }

    getter.value = value;

    // eslint-disable-next-line no-inner-declarations
    function setter(newValue) {
      if (obj === this) {
        throw new TypeError(
          `Cannot assign to read only property '${prop}' of object '${obj.name}'`
        );
      }
      if (objectHasOwnProperty.call(this, prop)) {
        this[prop] = newValue;
      } else {
        defineProperty(this, prop, {
          value: newValue,
          writable: true,
          enumerable: desc.enumerable,
          configurable: desc.configurable
        });
      }
    }

    defineProperty(obj, prop, {
      get: getter,
      set: setter,
      enumerable: desc.enumerable,
      configurable: desc.configurable
    });
  }
}

/**
 * These properties are subject to the override mistake.
 * We "repair" these data properties to getters
 * and setters.
 */
export function repairDataProperties(realmRec) {
  const { unsafeGlobal: _ } = realmRec;

  // Intentionally avoid loops and data structures.
  tamperProof(_.Object.prototype, 'constructor');
  tamperProof(_.Object.prototype, 'toLocaleString');
  tamperProof(_.Object.prototype, 'toString');
  tamperProof(_.Object.prototype, 'valueOf');
  tamperProof(_.Error.prototype, 'message');
  tamperProof(_.EvalError.prototype, 'message');
  tamperProof(_.RangeError.prototype, 'message');
  tamperProof(_.ReferenceError.prototype, 'message');
  tamperProof(_.SyntaxError.prototype, 'message');
  tamperProof(_.TypeError.prototype, 'message');
  tamperProof(_.URIError.prototype, 'message');
}
