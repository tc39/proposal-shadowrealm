export function getStdLib(intrinsics) {
  const descriptors = {
    // *** 18.1 Value Properties of the Global Object

    Infinity: { value: Infinity },
    NaN: { value: NaN },
    undefined: { value: undefined }
  };

  // All the following stdlib items have the same name on both our intrinsics
  // object and on the global object. Unlike Infinity/NaN/undefined, these
  // should all be writable and configurable.
  const names = [
    // *** 18.2 Function Properties of the Global Object

    'eval',
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
    // 'SharedArrayBuffer' // Deprecated on Jan 5, 2018
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

    // 'Atomics', // Deprecated on Jan 5, 2018
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

  for (const name of names) {
    descriptors[name] = {
      value: intrinsics[name],
      writable: true,
      configurable: true
    };
  }

  // TODO: we changed eval to be configurable along with everything else,
  // should we change it back to honor this earlier comment?
  // // Make eval writable to allow proxy to return a different
  // // value, and leave it non-configurable to prevent userland
  // // from changing its descriptor and breaking an invariant.

  // we need to prevent the user from manipulating the 'eval' binding while
  // simultaneously enabling the proxy to *switch* the 'eval' binding

  return descriptors;
}
