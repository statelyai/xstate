---
'xstate': patch
---

Fixed a regression in the inline actions type inference in models without explicit action creators.

```js
const model = createModel(
  { foo: 100 },
  {
    events: {
      BAR: () => ({})
    }
  }
);

model.createMachine({
  // `ctx` was of type `any`
  entry: (ctx) => {},
  exit: assign({
    // `ctx` was of type `unknown`
    foo: (ctx) => 42
  })
});
```
