import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';

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
        '@xstate/fsm': 'XStateFSM',
        'solid-js': 'Solid',
        'solid-js/store': 'SolidStore'
      }
    },
    plugins: [typescript(), terser()]
  };
}
export default [
  createUmdConfig({
    name: 'XStateSolid',
    input: 'src/index.ts',
    output: 'dist/xstate-solid.js'
  }),
  createUmdConfig({
    name: 'XStateSolid',
    input: 'src/index.ts',
    output: 'dist/xstate-solid.min.js'
  }),
  createUmdConfig({
    name: 'XStateSolidFSM',
    input: 'src/fsm.ts',
    output: 'dist/xstate-solid.fsm.js'
  }),
  createUmdConfig({
    name: 'XStateSolidFSM',
    input: 'src/fsm.ts',
    output: 'dist/xstate-solid.fsm.min.js'
  })
];
