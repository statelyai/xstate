---
'xstate': minor
---

Actors can now be spawned directly in the initial `machine.context` using lazy initialization, avoiding the need for intermediate states and unsafe typings for immediately spawned actors:

```ts
const machine = createMachine<{ ref: ActorRef<SomeEvent> }>({
  context: () => ({
    ref: spawn(anotherMachine, 'some-id') // spawn immediately!
  })
  // ...
});
```
