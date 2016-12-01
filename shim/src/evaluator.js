
const HookFnName = '$RealmEvaluatorIIFE$';

// Wrapping the source with `with` statement creates a new lexical scope,
// that can prevent access to the globals in the sandbox by shadowing them
// via globalProxy.
function addLexicalScopesToSource(sourceText) {
    /**
     * We use a `with` statement who uses `argments[1]`, which is the
     * `sandbox.globalProxy` that implements the shadowing mechanism.
     * Aside from that, the `this` value in sourceText will correspond to `sandbox.globalObject`.
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