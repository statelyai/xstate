---
'xstate': minor
---

Children IDs in combination with `setup` can now be typed using `types.children`:

```ts
const machine = setup({
  types: {} as {
    children: {
      myId: 'actorKey';
    };
  },
  actors: {
    actorKey: child
  }
}).createMachine({});

const actorRef = createActor(machine).start();

actorRef.getSnapshot().children.myId; // ActorRefFrom<typeof child> | undefined
```
