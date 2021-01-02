import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

function createTSCofig() {
  return typescript({
    tsconfigOverride: {
      compilerOptions: {
        declaration: false
      }
    }
  });
}

function createUmdConfig({ input, output: file, name }) {
  return {
    input,
    output: {
      file,
      format: 'umd',
      name,
      globals: {
        xstate: 'XState',
        '@xstate/fsm': 'XStateFSM',
        vue: 'Vue'
      }
    },
    plugins: [createTSCofig(), terser({ include: [/^.+\.min\.js$/] })]
  };
}

export default [
  createUmdConfig({
    name: 'XStateVue',
    input: 'src/index.ts',
    output: 'dist/xstate-vue.js'
  }),
  createUmdConfig({
    name: 'XStateVue',
    input: 'src/index.ts',
    output: 'dist/xstate-vue.min.js'
  }),
  createUmdConfig({
    name: 'XStateVueFSM',
    input: 'src/fsm.ts',
    output: 'dist/xstate-vue.fsm.js'
  }),
  createUmdConfig({
    name: 'XStateVueFSM',
    input: 'src/fsm.ts',
    output: 'dist/xstate-vue.fsm.min.js'
  })
];
