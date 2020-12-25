---
'xstate': patch
---

Instead of referencing `window` directly, XState now internally calls a `getGlobal()` function that will resolve to the proper `globalThis` value in all environments. This affects the dev tools code only.
