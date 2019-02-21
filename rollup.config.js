import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import rollupReplace from 'rollup-plugin-replace';
import fileSize from 'rollup-plugin-filesize';

const createConfig = ({ input, output, target }) => ({
  input,
  output,
  plugins: [
    rollupReplace({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    typescript({
      clean: true,
      tsconfigOverride: {
        compilerOptions: {
          declaration: false,
          ...(target ? { target } : {})
        }
      }
    }),
    terser({
      toplevel: true,
    }),
    fileSize()
  ]
});

export default [
  createConfig({
    input: 'src/index.ts',
    output: {
      file: 'dist/xstate.js',
      format: 'umd',
      name: 'XState'
    }
  }),
  createConfig({
    input: 'src/graph.ts',
    output: {
      file: 'dist/xstate.graph.js',
      format: 'umd',
      name: 'XStateGraph'
    }
  }),
  createConfig({
    input: 'src/interpreter.ts',
    output: {
      file: 'dist/xstate.interpreter.js',
      format: 'umd',
      name: 'XStateInterpreter'
    }
  }),
  createConfig({
    input: 'src/index.ts',
    output: {
      file: 'dist/xstate.web.js',
      format: 'esm'
    },
    target: 'ES2015'
  })
];
