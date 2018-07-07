// we'd like to abandon, but we can't, so just scream and break a lot of
// stuff. However, since we aren't really aborting the process, be careful to
// not throw an Error object which could be captured by child-Realm code and
// used to access the (too-powerful) primal-realm Error object.

export function throwTantrum(s, err = undefined) {
  const msg = `please report internal shim error: ${s}`;

  // note: we really do want to log these 'should never happen' things. there
  // might be a better way to convince the linter, though.
  // eslint-disable-next-line no-console
  console.error(msg);
  if (err) {
    // eslint-disable-next-line no-console
    console.error(`${err}`);
    // eslint-disable-next-line no-console
    console.error(`${err.stack}`);
  }

  // eslint-disable-next-line no-debugger
  debugger;
  throw msg;
}

export function assert(condition, message) {
  if (!condition) {
    throwTantrum(`failed to: ${message}`);
  }
}
