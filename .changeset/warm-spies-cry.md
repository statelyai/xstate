---
'xstate': patch
---

Fixed an issue where, when using `model.createMachine`, state's context was incorrectly inferred as `any` after refinement with `.matches(...)`, e.g.

```ts
// `state.context` became `any` erroneously
if (state.matches('inactive')) {
  console.log(state.context.count);
}
```
