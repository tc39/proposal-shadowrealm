export function assert(condition) {
  if (!condition) {
    throw new Error();
  }
}

export function IsCallable(obj) {
  return typeof obj === 'function';
}
