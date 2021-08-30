import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';

function createTSCofig() {
  return typescript({
    tsconfigOverride: {
      compilerOptions: {
        declaration: false
      }
    }
  });
}

const makeExternalPredicate = (externalArr) => {
  if (externalArr.length === 0) {
    return () => false;
  }
  const pattern = new RegExp(`^(${externalArr.join('|')})($|/)`);
  return (id) => pattern.test(id);
};

function createUmdConfig({ input, output: file, name }) {
  return {
    input,
    external: makeExternalPredicate(Object.keys(pkg.peerDependencies)),
    output: {
      file,
      format: 'umd',
      name,
      globals: {
        xstate: 'XState',
        '@xstate/fsm': 'XStateFSM'
      }
    },
    plugins: [createTSCofig(), terser({ include: [/^.+\.min\.js$/] })]
  };
}

export default [
  createUmdConfig({
    name: 'XStateLitController',
    input: 'src/index.ts',
    output: 'dist/xstate-lit-controller.js'
  }),
  createUmdConfig({
    name: 'XStateLitController',
    input: 'src/index.ts',
    output: 'dist/xstate-lit-controller.min.js'
  }),
  createUmdConfig({
    name: 'XStateLitControllerFSM',
    input: 'src/fsm.ts',
    output: 'dist/xstate-lit-controller.fsm.js'
  }),
  createUmdConfig({
    name: 'XStateLitControllerFSM',
    input: 'src/fsm.ts',
    output: 'dist/xstate-lit-controller.fsm.min.js'
  })
];
