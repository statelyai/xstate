import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import rollupReplace from 'rollup-plugin-replace';

const createConfig = ({ input, output }) => ({
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
          declaration: false
        }
      }
    }),
    terser()
  ]
});

export default [
  createConfig({
    input: 'src/index.ts',
    output: {
      file: 'dist/xstate.js',
      format: 'umd',
      name: 'xstate'
    }
  }),
  createConfig({
    input: 'src/graph.ts',
    output: {
      file: 'dist/xstate.graph.js',
      format: 'umd',
      name: 'xstateGraph'
    }
  }),
  createConfig({
    input: 'src/interpreter.ts',
    output: {
      file: 'dist/xstate.interpreter.js',
      format: 'umd',
      name: 'xstateInterpreter'
    }
  })
];
