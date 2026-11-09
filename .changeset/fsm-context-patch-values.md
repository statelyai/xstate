---
"xstate": patch
---

Apply context patches in `createFSM` when they add an own property or change a value, including symbol properties and changes from `0` to `-0`. Reapplying `NaN` keeps the current snapshot when the rest of the patch is unchanged.
