---
'@xstate/inspect': minor
---

The `@xstate/inspect` package is now built with Rollup which has fixed an issue with TypeScript compiler inserting references to `this` in the top-level scope of the output modules and thus making it harder for some tools (like Rollup) to re-bundle dist files as `this` in modules (as they are always in strict mode) is `undefined`.
