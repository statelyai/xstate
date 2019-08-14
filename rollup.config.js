import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import rollupReplace from 'rollup-plugin-replace';
import renameExtensions from '@betit/rollup-plugin-rename-extensions';
import fileSize from 'rollup-plugin-filesize';

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

const createNpmConfig = ({ input, output }) => ({
  input,
  output,
  preserveModules: true,
  plugins: [
    createTsPlugin(),
    // temporary solution until rollup/rollup#2847 gets resolved
    renameExtensions({
      mappings: {
        '.ts': '.js'
      }
    })
  ]
});

const createUmdConfig = ({ input, output, target }) => ({
  input,
  output,
  plugins: [
    rollupReplace({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    createTsPlugin({ declaration: false, target }),
    terser({
      toplevel: true
    }),
    fileSize()
  ]
});

export default [
  createNpmConfig({
    input: 'src/index.ts',
    output: [
      {
        dir: 'es',
        format: 'esm'
      },
      {
        dir: 'lib',
        format: 'cjs'
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
