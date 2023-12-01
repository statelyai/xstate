---
'xstate': major
---

Spawned actors that have a referenced source (not inline) can be deeply persisted and restored:

```ts
const machine = createMachine({
  context: ({ spawn }) => ({
    // This will be persisted
    ref: spawn('reducer', { id: 'child' })

    // This cannot be persisted:
    // ref: spawn(fromTransition((s) => s, { count: 42 }), { id: 'child' })
  })
}).provide({
  actors: {
    reducer: fromTransition((s) => s, { count: 42 })
  }
});
```
