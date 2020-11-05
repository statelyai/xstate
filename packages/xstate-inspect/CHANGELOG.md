# @xstate/inspect

## 0.2.0
### Minor Changes



- [`1725333a`](https://github.com/davidkpiano/xstate/commit/1725333a6edcc5c1e178228aa869c907d3907be5) [#1599](https://github.com/davidkpiano/xstate/pull/1599) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `@xstate/inspect` package is now built with Rollup which has fixed an issue with TypeScript compiler inserting references to `this` in the top-level scope of the output modules and thus making it harder for some tools (like Rollup) to re-bundle dist files as `this` in modules (as they are always in strict mode) is `undefined`.
