import typescript from 'rollup-plugin-typescript2';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import rollupReplace from 'rollup-plugin-replace';
import fileSize from 'rollup-plugin-filesize';
import glob from 'fast-glob';
import path from 'path';
import fs from 'fs';

const createTsPlugin = ({ declaration = true, target } = {}) =>
  typescript({
    clean: true,
    tsconfigOverride: {
      compilerOptions: {
        declaration,
        ...(target && { target })
      }
    }
  });

const createBabelPlugin = () =>
  babel({
    babelrc: false,
    configFile: false,
    skipPreflightCheck: true,
    babelHelpers: 'inline',
    extensions: ['.ts', '.tsx', '.js'],
    plugins: ['babel-plugin-annotate-pure-calls']
  });

const createNpmConfig = ({ input, output }) => ({
  input,
  output,
  preserveModules: true,
  plugins: [
    createTsPlugin(),
    createBabelPlugin(),
    /** @ts-ignore [symbolObservable] creates problems who are on older versions of TS, remove this plugin when we drop support for TS@<4.3 */
    {
      writeBundle(outputOptions, bundle) {
        const [, dtsAsset] = Object.entries(bundle).find(
          ([fileName]) => fileName === 'interpreter.d.ts'
        );

        const dtsPath = path.join(
          __dirname,
          outputOptions.dir,
          'interpreter.d.ts'
        );

        fs.writeFileSync(
          dtsPath,
          dtsAsset.source.replace(
            '[symbolObservable]():',
            '[Symbol.observable]():'
          )
        );
      }
    }
  ]
});

const createUmdConfig = ({ input, output, target = undefined }) => ({
  input,
  output,
  plugins: [
    rollupReplace({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    createTsPlugin({ declaration: false, target }),
    createBabelPlugin(),
    terser({
      toplevel: true
    }),
    fileSize()
  ]
});

const npmInputs = glob.sync('src/!(scxml|invoke|model.types|typegenTypes).ts');

export default [
  createNpmConfig({
    input: npmInputs,
    output: [
      {
        dir: 'lib',
        format: 'cjs'
      }
    ]
  }),
  createNpmConfig({
    input: npmInputs,
    output: [
      {
        dir: 'es',
        format: 'esm'
      }
    ]
  }),
  createUmdConfig({
    input: 'src/index.ts',
    output: {
      file: 'dist/xstate.js',
      format: 'umd',
      name: 'XState'
    }
  }),
  createUmdConfig({
    input: 'src/interpreter.ts',
    output: {
      file: 'dist/xstate.interpreter.js',
      format: 'umd',
      name: 'XStateInterpreter'
    }
  }),
  createUmdConfig({
    input: 'src/index.ts',
    output: {
      file: 'dist/xstate.web.js',
      format: 'esm'
    },
    target: 'ES2015'
  })
];
