// Adapted from SES/Caja - Copyright (C) 2011 Google Inc.
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/startSES.js
// https://github.com/google/caja/blob/master/src/com/google/caja/ses/repairES5.js

import verifyStrictFunctionBody from '../evaluate/verifyStrictFunctionBody';
import { getPrototypeOf, setPrototypeOf, defineProperty } from '../commons';

// This block replaces the original Function, %GeneratorFunction% and
// %AsycnGeneratorFunction%, with safe implementations that preserve SES
// confinement. After this block is done, the originals should no longer be
// reachable.

export default function repairFunctionConstructors(confinedWindow) {

    const { eval: secureEval } = confinedWindow;

    /**
     * A safe form of the {@code Function} constructor, which
     * constructs strict functions that can only refer freely to the
     * {@code sharedImports}.
     *
     * The returned function is strict whether or not it declares
     * itself to be.
     */
    function secureFunctionFactory(funcDeclaration) {
        return (function SecureFunction(...params) {
            var body = verifyStrictFunctionBody(params.pop() || '');

            var exprSrc = `
(${funcDeclaration}(${params.join(',')} {
    ${body}
})`;
            return secureEval(exprSrc);
        });
    }

    // Our process to secure constructors:
    // 1. Obtain the original prototype of an instance from the sandbox
    // 2. Create a secure constructor
    // 3. Replace its prototype property with the original prototype
    // 4*. Replace its internal [[Prototype]] property with a secure function (except for Function)
    // 5. Replace the original prototype's constructor with the secure constructor
    // 6*. Export the secure function to the sandbox (only for Function)

    const FuncProto = getPrototypeOf(secureEval('(function () {})'));
    const secureFunction = secureFunctionFactory('function');
    defineProperty(secureFunction, 'prototype', { value: FuncProto });
    defineProperty(secureFunction, 'toString', { value: () => 'function Function() { [shim code] }' });
    // Function already has [[Prototype]] defined as itself
    defineProperty(FuncProto, 'constructor', { value: secureFunction });
    confinedWindow.Function = secureFunction;

    const GenFuncProto = getPrototypeOf(secureEval('(function* () {})'));
    const secureGenerator = secureFunctionFactory('function*');
    defineProperty(secureGenerator, 'prototype', { value: GenFuncProto });
    defineProperty(secureGenerator, 'toString', { value: () => 'function GeneratorFunction() { [shim code] }' });
    setPrototypeOf(secureGenerator, secureFunction);
    defineProperty(GenFuncProto, 'constructor', { value: secureGenerator });
    // Generator isn't exported on global

    const AsyncFuncProto = getPrototypeOf(secureEval('(async function () {})'));
    const secureAsyncFunction = secureFunctionFactory('async function');
    defineProperty(secureAsyncFunction, 'prototype', { value: AsyncFuncProto });
    defineProperty(secureAsyncFunction, 'toString', { value: () => 'function AsyncFunction() { [shim code] }' });
    setPrototypeOf(secureAsyncFunction, secureFunction);
    defineProperty(AsyncFuncProto, 'constructor', { value: secureAsyncFunction });
    // AsyncFunction isn't exported on global
}
