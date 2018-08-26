import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

const createConfig = ({ input, output }) => ({
  input,
  output,
  plugins: [
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
      file: 'dist/xstate.utils.js',
      format: 'umd',
      name: 'xstateUtils'
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
