function createIframe() {
    const el = document.createElement("iframe");
    el.style.display = "none";
    // accessibility
    el.title = "script";
    el.setAttribute('aria-hidden', true);
    document.body.appendChild(el);
    return el;
}

export function createSandbox(customGlobalObj, customThisValue) {
    const iframe = createIframe();
    const { contentDocument: iframeDocument, contentWindow: confinedWindow } = iframe;
    const globalObject = customGlobalObj || confinedWindow.Object.create(null);
    const thisValue = customThisValue || globalObject;
    return {
        iframe,
        iframeDocument,
        confinedWindow,
        thisValue,
        globalObject,
        globalProxy: undefined,
    };
}