import { evaluate } from './evaluate';
import { setPrototypeOf } from './commons';

function getEvalEvaluator(sandbox) {
  const o = {
    // trick to set the name of the function to "eval"
    eval: function(sourceText) {
      // console.log(`Shim-Evaluation: "${sourceText}"`);
      return evaluate(sourceText, sandbox);
    }
  };
  setPrototypeOf(o.eval, sandbox.Function);
  o.eval.toString = () => 'function eval() { [shim code] }';
  return o.eval;
}

function getFunctionEvaluator(sandbox) {
  const { confinedWindow } = sandbox;
  const f = function Function(...args) {
    // console.log(`Shim-Evaluation: Function("${args.join('", "')}")`);
    const sourceText = args.pop();
    const fnArgs = args.join(', ');
    return evaluate(`(function anonymous(${fnArgs}){\n${sourceText}\n}).bind(this)`, sandbox);
  };
  f.prototype = confinedWindow.Function.prototype;
  setPrototypeOf(f, f.prototype);
  f.prototype.constructor = f;
  f.toString = () => 'function Function() { [shim code] }';
  return f;
}

export function getEvaluators(sandbox) {
  sandbox.Function = getFunctionEvaluator(sandbox);
  sandbox.eval = getEvalEvaluator(sandbox);
}
