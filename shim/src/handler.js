export class Handler {
  // Properties stored on the handler
  // are not available from the proxy.

  constructor(sandbox) {
    const { unsafeGlobal } = sandbox;
    this.unsafeGlobal = unsafeGlobal;

    // this flag allow us to determine if the eval() call is a controlled
    // eval done by the realm's code or if it is user-land invocation, so
    // we can react differently.
    this.isInternalEvaluation = false;
  }

  get(target, prop) {
    // Special treatment for eval.
    if (prop === 'eval') {
      if (this.isInternalEvaluation) {
        this.isInternalEvaluation = false;
        return this.unsafeGlobal.eval;
      }
      return target.eval;
    }
    // Properties of the global.
    if (prop in target) {
      return target[prop];
    }
    // Prevent the lookup for other properties.
    return undefined;
  }

  has(target, prop) {
    if (prop === 'eval') {
      return true;
    }
    if (prop === 'arguments') {
      return false;
    }
    if (prop in target) {
      return true;
    }
    if (prop in this.unsafeGlobal) {
      return true;
    }
    return false;
  }
}
