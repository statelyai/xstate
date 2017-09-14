import rollupNodeResolve from "rollup-plugin-node-resolve";
import fileSize from 'rollup-plugin-filesize';
const pkg = require("./package.json");
const tsconfig = require("./tsconfig.json");
 
export default {
  entry: "lib/index.js",
  dest: "dist/xstate.js",
  format: "iife",
  exports: "named",
  moduleName: "xstate",
  context: "window",
  plugins: [
    rollupNodeResolve(),
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
