---
'xstate': patch
---

An inline invoke's `onDone.event.output` is now `unknown` with no registered
actor sources. Use `s.createInvoke({ src, onDone })` or register the
actor in `setup({ actors })` to get its exact output type.

```ts
const s = setup({});
const machine = s.createMachine({
  invoke: s.createInvoke({
    src: loadUser,
    onDone: ({ event }) => ({ context: { user: event.output } })
  })
});
```

A literal invoke ID now types its entry in `snapshot.children` from the invoked
actor. An empty `schemas.events: {}` no longer erases the context and input
types in a final state's output callback. Restoring a machine held in Vue
reactive state now keeps its state value consistent after the next transition.
  
