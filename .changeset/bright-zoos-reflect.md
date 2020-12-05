---
'xstate': minor
---

Spawned/invoked actors and interpreters are now typed as extending `ActorRef` (e.g., `SpawnedActorRef`) rather than `Actor` or `Interpreter`. This unification of types should make it more straightforward to provide actor types:

```diff
import {
- Actor
+ ActorRef
} from 'xstate';

// ...

interface SomeContext {
- server?: Actor;
+ server?: ActorRef<ServerEvent>;
}
```

It's also easier to specify the type of a spawned/invoked machine with `ActorRefFrom`:

```diff
import {
  createMachine,
- Actor
+ ActorRefFrom
} from 'xstate';

const serverMachine = createMachine<ServerContext, ServerEvent>({
  // ...
});

interface SomeContext {
- server?: Actor; // difficult to type
+ server?: ActorRefFrom<typeof serverMachine>;
}
```
