import { createEvalEvaluatorFactory } from './evaluators';
import { sanitize } from './sanitize';

// The sandbox is shim-specific. It acts as the mechanism
// to obtain a fresh set of intrinsics together with their
// associated eval and Function evaluators. This association
// must be respected since the evaluators are imposing a
// set of intrinsics, aka the "undeniables".

function createContext() {
  const iframe = document.createElement('iframe');

  iframe.title = 'script';
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', true);

  document.body.appendChild(iframe);

  return iframe.contentWindow;
}

export function createSandbox(context) {
  if (context === undefined) {
    context = createContext();
  }
  // The sandbox is entirely defined by these three objects.
  // Reusing the terminology from SES/Caja.
  const sandbox = {
    unsafeGlobal: context,
    unsafeEval: context.eval,
    unsafeFunction: context.Function
  };
  if (sandbox.evalEvaluatorFactory === undefined) {
    sandbox.evalEvaluatorFactory = createEvalEvaluatorFactory(sandbox);
  }
  sanitize(sandbox);
  return sandbox;
}
