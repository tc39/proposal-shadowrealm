// we'd like to abandon, but we can't, so just scream and break a lot of
// stuff. However, since we aren't really aborting the process, be careful to
// not throw an Error object which could be captured by child-Realm code and
// used to access the (too-powerful) primal-realm Error object.

export function throwTantrum(s, err = undefined) {
  const msg = `please report internal shim error: ${s}`;
  // note: we really do want to log these 'should never happen' things. there
  // might be a better way to convince the linter, though.
  console.log(msg); // eslint-disable-line
  if (err) {
    console.log(`${err}`); // eslint-disable-line
    console.log(`${err.stack}`); // eslint-disable-line
  }
  throw msg;
}

export function assert(condition, message) {
  if (!condition) {
    throwTantrum(`failed to: ${message}`);
  }
}

// TOCTTOU and .asString() games could enable attacker to skip some
// intermediate ancestors, so we stringify/propify this once, first.
export function asPropertyName(s) {
  if (typeof s === 'symbol') {
    return s;
  }
  return `${s}`;
}
