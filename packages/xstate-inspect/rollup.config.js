import typescript from 'rollup-plugin-typescript2';

const createTsPlugin = () =>
  typescript({
    clean: true,
    tsconfigOverride: {
      compilerOptions: {
        declaration: true
      }
    }
  });

const createNpmConfig = ({ input, output }) => ({
  input,
  output,
  preserveModules: true,
  external: ['xstate', 'xstate/lib/utils'],
  plugins: [createTsPlugin()]
});

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
  })
];
