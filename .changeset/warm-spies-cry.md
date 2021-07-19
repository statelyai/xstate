---
'xstate': patch
---

Fixed an issue with states coming from `model.createMachine` resulting in contexts of type `any` after type refinements such as here:

```ts
// `state.context` became `any` erroneously
if (state.matches('inactive')) {
  console.log(state.context.count);
}
```
