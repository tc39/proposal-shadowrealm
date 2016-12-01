
const HookFnName = '$RealmEvaluatorIIFE$';

// TODO: we really need to find a way to do the right thing here.
// wrapping the source with `with` statements create a new lexical scope,
// that can prevent access to the globals in the sandbox by shadowing them
// with the properties of the windshield.
// additionally, strict mode is enforced to prevent leaking
// global variables into the sandbox.
function addLexicalScopesToSource(sourceText) {
    /**
     * We use two `with` statements, the outer one uses `argments[1]`, which is the
     * `sandbox.windshield`, while the inner `with` statement uses `argument[0]`,
     * which is the realm's global object. Aside from that, the `this` value in
     * sourceText will correspond to `argument[0]` as well.
     */
    return `
        function ${HookFnName}() {
            with(arguments[0]) {
                return (function(){
                    "use strict";
                    return eval(\`${sourceText}\`);
                }).call(this);
            }
        }
    `;
}

function evalAndReturn(sourceText, sandbox) {
    const { iframeDocument, confinedWindow } = sandbox;
    const { body: iframeBody } = iframeDocument;
    const script = iframeDocument.createElement('script');
    script.type = 'text/javascript';
    confinedWindow[HookFnName] = undefined;
    script.appendChild(iframeDocument.createTextNode(sourceText));
    iframeBody.appendChild(script);
    iframeBody.removeChild(script);
    const result = confinedWindow[HookFnName];
    confinedWindow[HookFnName] = undefined;
    return result;
}

export function evaluate(sourceText, sandbox) {
    if (!sourceText) {
        return undefined;
    }
    sourceText = addLexicalScopesToSource(sourceText);
    const fn = evalAndReturn(sourceText, sandbox);
    return fn.apply(sandbox.globalObject, [sandbox.globalProxy]);
}