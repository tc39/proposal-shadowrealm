import { evaluate } from "./evaluate";
import { setPrototypeOf } from "./commons";

function getEvalEvaluator(sandbox) {
    const o = {
        // trick to set the name of the function to "eval"
        eval: function(sourceText) {
            // console.log(`Shim-Evaluation: "${sourceText}"`);
            return evaluate(sourceText, sandbox);
        }
    };
    // TODO
    // setPrototypeOf(o.eval, sandbox.Function);
    o.eval.toString = () => 'function eval() { [shim code] }';
    return o.eval;
}

export function getEvaluators(sandbox) {
    sandbox.eval = getEvalEvaluator(sandbox);
}