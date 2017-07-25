export function assert(condition) {
    if (!condition) {
        throw new Error();
    }
}

function IsCallable(obj) {
    return typeof obj === 'function';
}