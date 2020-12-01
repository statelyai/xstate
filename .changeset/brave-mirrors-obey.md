---
'@xstate/react': minor
---

Spawned/invoked actors and interpreters are now typed as extending `ActorRef` rather than `Actor` or `Interpreter`. This unification of types should make it more straightforward to provide actor types in React:

```ts
import { ActorRef } from 'xstate';
import { useActor } from '@xstate/react';

const Child: React.FC<{ actorRef: ActorRef<SomeEvent, SomeEmitted> }> = ({
  actorRef
}) => {
  // `state` is typed as `SomeEmitted`
  // `send` can be called with `SomeEvent` values
  const [state, send] = useActor(actorRef);

  // . ..
};
```

It's also easier to specify the type of a spawned/invoked machine with `ActorRefFrom`:

```ts
import { createMachine, ActorRefFrom } from 'xstate';
import { useActor } from '@xstate/react';

const someMachine = createMachine<SomeContext, SomeEvent>({
  // ...
});

const Child: React.FC<{ someRef: ActorRefFrom<typeof someMachine> }> = ({
  someRef
}) => {
  // `state` is typed as `State<SomeContext, SomeEvent>`
  // `send` can be called with `SomeEvent` values
  const [state, send] = useActor(someRef);

  // . ..
};
```
