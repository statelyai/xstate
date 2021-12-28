---
'@xstate/fsm': patch
---

author: @annaghi
pr: #2474

Use CommonJS files as `package.json#main` (instead of UMD files) as this plays better with native ESM loader in node (and by extension fixes compatibility issues with projects like [SvelteKit](https://kit.svelte.dev/)).
