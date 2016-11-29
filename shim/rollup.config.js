/*jshint node: true */

'use strict'

const fs = require('fs');
const path = require('path');
const argv = require('yargs').argv;
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const uglify = require('rollup-plugin-uglify');
const strip = require('rollup-plugin-strip');
const rollup = require('rollup');

let babelConfig = JSON.parse(fs.readFileSync('shim/.babelrc', 'utf8'));
babelConfig.babelrc = false;
babelConfig.presets = babelConfig.presets.map((preset) => {
    return preset === 'es2015' ? 'es2015-rollup' : preset;
});

const plugins = [
    babel(babelConfig),
    commonjs({
        sourceMap: true
    })
];

if (argv.production) {
    plugins.push(
        strip({
            debugger: true,
            functions: [ 'console.*', 'assert.*' ],
        })
    );
    plugins.push(
        uglify({
            warnings: false
        })
    );
}

function buildBundle(bundleConfig) {
    return rollup.rollup(bundleConfig.input)
        .then(function(bundle) {
            return bundle.write(bundleConfig.output);
        }).then(() => bundleConfig.output.dest);
}

const bundleConfig = {
    folder: 'shim/src/',
    input: {
        entry: 'shim/src/main.js',
        plugins: plugins,
    },
    output: {
        dest: 'shim/dist/realm-shim.js',
        format: 'umd',
        moduleName: 'RealmShim',
        sourceMap: true,
    }
};

if (argv.watch) {
    console.log('watching...');

    const watch = require('watch');
    const EventEmitter = require('events');
    const watcher = new EventEmitter();

    watch.watchTree(bundleConfig.folder, function onFileChange() {
        buildBundle(bundleConfig)
            .then((dest) => {
                console.log('-> built [%s] bundle', dest);
                watcher.emit('rolled');
            })
            .catch((err) => {
                console.error(err.stack)
            });
    });
} else {
    console.log('building...');

    buildBundle(bundleConfig).catch((err) => {
        console.error(err.stack)
    });
}
