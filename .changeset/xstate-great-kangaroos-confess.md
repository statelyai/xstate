---
'xstate': major
---

You can now add a `systemId` to spawned actors to reference them anywhere in the system.

```ts
const machine = createMachine({
  // ...
  context: ({ spawn }) => ({
    actorRef: spawn(
      createMachine({
        // ...
      }),
      { systemId: 'actorRef' }
    )
  })
});
```
