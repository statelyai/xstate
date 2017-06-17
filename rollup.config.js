import rollupNodeResolve from "rollup-plugin-node-resolve";
import rollupAlias from "rollup-plugin-alias";
import rollupTS from "rollup-plugin-ts";
import typescript from "typescript";
import fileSize from 'rollup-plugin-filesize';
const pkg = require("./package.json");
const tsconfig = require("./tsconfig.json");
 
export default {
  entry: "src/index.ts",
  dest: "dist/xstate.js",
  format: "iife",
  exports: "named",
  moduleName: "xstate",
  context: "window",
  plugins: [
    rollupAlias({
      /**
       * TypeScript@^2.1.0
       *
       * Using TypeScript helpers from external library. To enable importing helpers from external library,
       * `tsconfig.json` should have `"importHelpers": true`.
       *
       * Right now tslib library doesn't have `module` or `jsnext:main` directive in `package.json`. Fix for this issue
       * is coming, keep an eye on [tslib](https://github.com/Microsoft/tslib) library.
       */
      tslib: "node_modules/tslib/tslib.es6.js",
    }),
    rollupNodeResolve(),
    rollupTS({
      /**
       * `typescript` options that specifies TypeScript compiler is **mandatory**, `rollup-plugin-ts` doesn't include
       * TypeScript compiler.
       */
      typescript: typescript,
      tsconfig: tsconfig.compilerOptions,
    }),
    fileSize()
  ],
  targets: [
    {
      dest: pkg["main"],
      format: "umd",
      moduleName: "xstate",
      sourceMap: true
    },
    {
      dest: pkg["module"],
      format: "es",
      sourceMap: true
    }
  ],
}
