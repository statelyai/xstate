import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import replace from 'rollup-plugin-replace';

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
        '@xstate/react': 'XStateReact'
      }
    },
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production')
      }),
      createTSCofig(),
      terser({ include: [/^.+\.min\.js$/] })
    ]
  };
}

export default [
  createUmdConfig({
    name: 'XStateReact',
    input: 'src/index.ts',
    output: 'dist/xstate-react.umd.min.js'
  }),
  createUmdConfig({
    name: 'XStateReactFSM',
    input: 'src/fsm.ts',
    output: 'dist/xstate-react-fsm.umd.min.js'
  })
];
