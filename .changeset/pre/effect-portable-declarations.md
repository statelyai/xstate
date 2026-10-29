---
'@xstate/effect': patch
---

Exported `setupEffect(...)` results and machines created from them now emit portable declarations. Previously, `declaration: true` builds failed with TS4023 or TS2883 when exporting them without a type annotation.

```ts
export const machine = setupEffect({
  actions: { audit: (_args) => Effect.void }
}).createMachine({});
```
