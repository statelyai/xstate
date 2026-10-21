---
'@xstate/svelte': patch
---

Publish `@xstate/svelte` as an ES module so `import` resolves to real ESM instead of a CommonJS wrapper. This fixes Vitest and other ESM tooling failing with `require('svelte/store')` errors against Svelte's ESM-only builds. `require('@xstate/svelte')` still works on Node versions that support `require(esm)`.
