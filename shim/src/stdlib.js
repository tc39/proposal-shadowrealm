// All the following stdlib items have the same name on both our intrinsics
// object and on the global object. Unlike Infinity/NaN/undefined, these
// should all be writable and configurable.
const sharedGlobalPropertyNames = [
  // *** 18.2 Function Properties of the Global Object

  // 'eval', // comes from safeEval instead
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
  // 'Function', // comes from safeFunction instead
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
  // 'SharedArrayBuffer' // removed on Jan 5, 2018
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

  // 'Atomics', // removed on Jan 5, 2018
  'JSON',
  'Math',
  'Reflect',

  // *** Annex B

  'escape',
  'unescape',

  // *** ECMA-402

  'Intl'

  // *** ESNext

  // 'Realm' // Comes from createRealmGlobalObject()
];

export function getUnsafeGlobalDescs(unsafeGlobal) {
  const descriptors = {
    // *** 18.1 Value Properties of the Global Object
    Infinity: { value: Infinity },
    NaN: { value: NaN },
    undefined: { value: undefined }
  };

  for (const name of sharedGlobalPropertyNames) {
    descriptors[name] = {
      value: unsafeGlobal[name],
      writable: true,
      configurable: true
    };
  }

  return descriptors;
}
