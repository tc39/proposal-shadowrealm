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
    const globalObject = confinedWindow.Object.create(null);
    return {
        iframe,
        iframeDocument,
        confinedWindow,
        globalObject,
        globalProxy: undefined,
    };
}