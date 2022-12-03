import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from 'rollup-plugin-replace';
import { terser } from 'rollup-plugin-terser';

const makeExternalPredicate = (externalArr) => {
  if (externalArr.length === 0) {
    return () => false;
  }
  const pattern = new RegExp(`^(${externalArr.join('|')})($|/)`);
  return (id) => pattern.test(id);
};

const createTsPlugin = (declaration = true) =>
  typescript({
    clean: true,
    tsconfigOverride: {
      compilerOptions: {
        declaration
      }
    }
  });

const createNpmConfig = ({ input, output }) => ({
  input,
  output,
  preserveModules: true,
  external: makeExternalPredicate([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies | {})
  ]),
  plugins: [createTsPlugin()]
});

function createUmdConfig({ input, output: file, name }) {
  return {
    input,
    external: makeExternalPredicate(Object.keys(pkg.peerDependencies)),
    output: {
      file,
      format: 'umd',
      name,
      globals: {
        xstate: 'XState'
      }
    },
    plugins: [
      commonjs(),
      resolve({
        browser: true
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify('production')
      }),
      createTsPlugin(false),
      terser()
    ]
  };
}

export default [
  createNpmConfig({
    input: 'src/index.ts',
    output: [
      {
        dir: 'es',
        format: 'esm'
      }
    ]
  }),
  createNpmConfig({
    input: ['src/index.ts', 'src/server.ts'],
    output: [
      {
        dir: 'lib',
        format: 'cjs'
      }
    ]
  }),
  createUmdConfig({
    name: 'XStateInspect',
    input: 'src/index.ts',
    output: 'dist/xstate-inspect.umd.min.js'
  })
];
