import { createSandbox } from "./sandbox.js";
import { sanitize } from "./sanitize.js";
import { evaluate } from "./evaluate.js";
import { getEvaluators } from "./evaluators.js";
import { getStdLib } from "./stdlib.js";
import { getIntrinsics } from "./intrinsics.js";
import { proxyHandler } from "./proxy.js";

const RealmToSandbox = new WeakMap();

function getSandbox(realm) {
    const sandbox = RealmToSandbox.get(realm);
    if (!sandbox) {
        throw new Error(`Invalid realm object.`);
    }
    return sandbox;
}

export default class Realm {

    constructor() {
        const sandbox = createSandbox();
        sanitize(sandbox);
        Object.assign(sandbox, getEvaluators(sandbox));
        // TODO: assert that RealmToSandbox does not have `this` entry
        RealmToSandbox.set(this, sandbox);
        sandbox.globalProxy = new Proxy(sandbox, proxyHandler);
        this.global = sandbox.globalObject;
        this.init();
    }

    init() {
        Object.defineProperties(this.global, this.stdlib);
    }

    eval(sourceText) {
        const sandbox = getSandbox(this);
        return evaluate(sourceText, sandbox);
    }

    get stdlib() {
        const sandbox = getSandbox(this);
        return getStdLib(sandbox);
    }

    get intrinsics() {
        const sandbox = getSandbox(this);
        return getIntrinsics(sandbox);
    }

}

Realm.toString = () => 'function Realm() { [shim code] }';