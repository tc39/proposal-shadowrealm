import Realm from './realm';
import { assign } from './commons';
import { tamperProofDataProperties } from './tamper-proof';
import { deepFreeze } from './deep-freeze';

// Property names of standard lib that will pre-frozen ande declared as constants
// to circumvent the deoptimization introduced by the with statement.
// Only eval is omitted: it can't be a constant, since it needs to context switch.
const stdlib = [
  // *** 18.2 Function Properties of the Global Object

  // 'eval', // This property must be omitted to allow switching.
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',

  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',

  // *** 18.3 Constructor Properties of the Global Object

  'Array',
  'ArrayBuffer',
  'Boolean',
  'DataView',
  'Date',
  'Error',
  'EvalError',
  'Float32Array',
  'Float64Array',
  'Function',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Map',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'RangeError',
  'ReferenceError',
  'RegExp',
  'Set',
  // 'SharedArrayBuffer', / Deprecated on Jan 5, 2018
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array',
  'URIError',
  'WeakMap',
  'WeakSet',

  // *** 18.4 Other Properties of the Global Object

  'Atomics',
  'JSON',
  'Math',
  'Reflect',

  // *** Annex B

  'escape',
  'unescape',

  // *** ECMA-402

  'Intl',

  // *** ESNext

  'Realm'
];

/**
 * This evaluator declares commonly used references as constants
 * to allow the JIT optimizer to link to static references.
 */
function getDirectEvalEvaluatorFactory(sandbox) {
  const { unsafeFunction } = sandbox;

  return unsafeFunction(`
    with (arguments[0]) {
      const {${stdlib.join(',')}} = arguments[0];
      return function() {
        'use strict';
        return eval(arguments[0]);
      };
    }
  `);
}

class FrozenRealm extends Realm {
  constructor(options) {
    const opts = Object(options);

    getOwnPropertyNames;

    // Global hook
    const unfrozenSet = new Set();
    function afterGetGlobalPropery(value, name) {
      // only freezing members that are stdlibs to avoid freezing
      // new global properties. this also support polyfilling.
      if (!unfrozenSet.has(name)) {
        deepFreeze(value);
        unfrozenSet.delete(name);
      }
      // Return the original value. Other implementations could
      // here return a poxy object instead.
      return value;
    }

    // Supply addional parameters without modifying the original object.
    const opts = assign({ globalHook, getDirectEvalEvaluatorFactory }, options);
    super(opts);

    //
    let difference = globals.filter(name => !stdlib.includes(name));

    // The following two opeations are related and operate on
    // the same object.
    tamperProofDataProperties(this.intrinsics);
    deepFreeze(this.intrinsics);
  }
}

FrozenRealm.toString = () => 'function FrozenRealm() { [shim code] }';
