/* eslint-env node */

/**
 * This file builds the browser version in shim/dist/ folder.
 */

'use strict'

const path = require('path');
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
    entry: path.resolve('shim/src/main.js'),
    dest: path.resolve('shim/dist/realm-shim.js'),
    format: 'umd',
    moduleName: 'RealmShim',
    sourceMap: true,
    plugins: [
        babel(),
        isProduction && uglify({
            warnings: false,
        }),
    ].filter(Boolean),
};