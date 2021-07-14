---
'xstate': minor
---

There is a new `.preserveActionOrder` (default: `false`) setting in the machine configuration that preserves the order of actions when set to `true`. Normally, actions are executed in order _except_ for `assign(...)` actions, which are prioritized and executed first. When `.preserveActionOrder` is set to `true`, `assign(...)` actions will _not_ be prioritized, and will instead run in order. As a result, actions will capture the **intermediate `context` values** instead of the resulting `context` value from all `assign(...)` actions.

```ts
// With `.preserveActionOrder: true`
const machine = createMachine({
  context: { count: 0 },
  entry: [
    (ctx) => console.log(ctx.count), // 0
    assign({ count: (ctx) => ctx.count + 1 }),
    (ctx) => console.log(ctx.count), // 1
    assign({ count: (ctx) => ctx.count + 1 }),
    (ctx) => console.log(ctx.count) // 2
  ],
  preserveActionOrder: true
});

// With `.preserveActionOrder: false` (default)
const machine = createMachine({
  context: { count: 0 },
  entry: [
    (ctx) => console.log(ctx.count), // 2
    assign({ count: (ctx) => ctx.count + 1 }),
    (ctx) => console.log(ctx.count), // 2
    assign({ count: (ctx) => ctx.count + 1 }),
    (ctx) => console.log(ctx.count) // 2
  ]
  // preserveActionOrder: false
});
```
