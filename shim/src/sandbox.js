import { sanitize } from "./sanitize";
import { getEvaluators } from "./evaluators";
import { proxyHandler } from "./proxy";

function createIframe() {
    const el = document.createElement("iframe");
    el.style.display = "none";
    // accessibility
    el.title = "script";
    el.setAttribute('aria-hidden', true);
    document.body.appendChild(el);
    return el;
}

export function createSandbox() {
    const iframe = createIframe();
    const { contentDocument: iframeDocument, contentWindow: confinedWindow } = iframe;
    const sandbox = {
        iframe,
        iframeDocument,
        confinedWindow,
        thisValue: undefined,
        globalObject: undefined,
        globalProxy: undefined,
    };
    sanitize(sandbox);
    Object.assign(sandbox, getEvaluators(sandbox));
    sandbox.globalProxy = new Proxy(sandbox, proxyHandler);
    return sandbox;
}

export function setSandboxGlobalObject(sandbox, globalObject, thisValue) {
    sandbox.thisValue = thisValue;
    sandbox.globalObject = globalObject;
}