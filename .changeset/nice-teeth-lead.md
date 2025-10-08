---
'xstate': minor
---

Adds `system.getAll` that returns a record of running actors within the system by their system id

```ts
const childMachine = createMachine({});
const machine = createMachine({
  // ...
  invoke: [
    {
      src: childMachine,
      systemId: 'test'
    }
  ]
});
const system = createActor(machine);

system.getAll(); // { test: ActorRefFrom<typeof childMachine> }
```
