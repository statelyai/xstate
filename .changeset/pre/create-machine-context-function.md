---
'xstate': patch
---

`createMachine()` without `schemas.context` now infers the context type from the return value of a `context` function, as it already did from a context object:

- With TypeScript 5.9 and 6.0, the context type was the function itself, so reading `snapshot.context.count` was a type error.
- Actor refs created with the function's `spawn` were typed `any`. They now have the type of the spawned logic.
- Next to an `invoke` whose `src` is an unregistered machine, the call failed with TS2769 ("… is not assignable to type 'never'") against the published declarations.

```ts
const machine = createMachine({
  actors: { connection },
  context: ({ spawn, actors }) => ({
    count: 0,
    connection: spawn(actors.connection, { id: 'connection' })
  })
});

const { context } = createActor(machine).getSnapshot();
context.count; // number
context.connection; // ActorRefFromLogic<typeof connection>, was `any`
```
