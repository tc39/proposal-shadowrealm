import path from 'path';
import minify from 'rollup-plugin-babel-minify';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  input: path.resolve('shim/src/main.js'),
  output: {
    file: path.resolve(isProduction ? 'shim/dist/realm-shim.min.js' : 'shim/dist/realm-shim.js'),
    name: 'Realm',
    format: 'umd',
    sourcemap: true
  },
  plugins: [
    isProduction
      ? minify({
          comments: false
        })
      : {}
  ]
};
