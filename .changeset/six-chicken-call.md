---
'xstate': minor
---

There is now support for "combinatorial machines" (state machines that only have one state):

```js
const testMachine = createMachine({
  context: { value: 42 },
  on: {
    INC: {
      actions: assign({ value: (ctx) => ctx.value + 1 })
    }
  }
});
```

These machines omit the `initial` and `state` properties, as the entire machine is treated as a single state.
