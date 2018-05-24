import { getDirectEvalEvaluatorFactory } from './evaluators';
import { sanitize } from './sanitize';

// Detection used in RollupJS.
const isNode = typeof exports === 'object' && typeof module !== 'undefined';
const vm = isNode ? require('vm') : undefined;

const contextRecSrc = '({ global: this, eval, Function })';

// The contextRec is shim-specific. It acts as the mechanism
// to obtain a fresh set of intrinsics together with their
// associated eval and Function evaluators. This association
// must be respected since the evaluators are imposing a
// set of intrinsics, aka the "undeniables".

function createNodeContext() {
  const context = vm.runInNewContext(contextRecSrc);
  return context;
}

function createBrowserContext() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';

  document.body.appendChild(iframe);
  const context = iframe.contentWindow.eval(contextRecSrc);

  return context;
}

const createContext = isNode ? createNodeContext : createBrowserContext;

export function createContextRec(context) {
  if (context === undefined) {
    context = createContext();
  }

  const contextRec = {
    contextGlobal: context.global,
    contextEval: context.eval,
    contextFunction: context.Function
  };

  // Create the evaluator factory that will generate the evaluators
  // for each compartment realm.
  contextRec.evalEvaluatorFactory = getDirectEvalEvaluatorFactory(contextRec);

  sanitize(contextRec);
  return contextRec;
}

// The current context is the context where the
// Realm shim is being parsed and executed.
function getCurrentContext() {
  return (0, eval)(contextRecSrc);
}

export function getCurrentContextRec() {
  const context = getCurrentContext();
  return createContextRec(context);
}
