let windshieldCache;

function createIframe() {
    const el = document.createElement("iframe");
    el.style.display = "none";
    // accessibility
    el.title = "script";
    el.setAttribute('aria-hidden', true);
    document.body.appendChild(el);
    return el;
}

function getWindshield(iframe) {
    if (windshieldCache) {
        return windshieldCache;
    }
    const { contentWindow: confinedWindow } = iframe;
    const windshieldCache = confinedWindow.Object.create(null);
    /**
     * This is a one time operation to create this giant object with a bunch of properties
     * set to `undefined` to shadow every global binding in iframes' `window`.
     * This object will be used as the base lexical scope when evaluating source text
     * inside any realm. It can be reused because it has no authority, and it should always
     * be the same since the window object of a brand new iframe is always the same as well.
     */
    Object.getOwnPropertyNames(confinedWindow).forEach(function (name) {
        // TODO: recursive to cover WindowPrototype properties as well
        Object.defineProperty(windshieldCache, name, {
            value: undefined,
            enumerable: false,
            configurable: false,
            writable: false,
        });
    });
    Object.freeze(windshieldCache);
    return windshieldCache;
}

export function createSandbox() {
    const iframe = createIframe();
    const { contentDocument: iframeDocument, contentWindow: confinedWindow } = iframe;
    const windshield = getWindshield(iframe);
    return {
        windshield,
        iframe,
        iframeDocument,
        confinedWindow,
    };
}