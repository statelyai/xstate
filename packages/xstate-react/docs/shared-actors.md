---
title: Share actors
description: Provide one actor to a React subtree.
---

Create an actor context when several components need the same actor.

```tsx
import { createActorContext } from '@xstate/react';

const Counter = createActorContext(counterMachine);

function App() {
  return (
    <Counter.Provider>
      <CounterView />
    </Counter.Provider>
  );
}

function CounterView() {
  const count = Counter.useSelector((snapshot) => snapshot.context.count);
  const actorRef = Counter.useActorRef();
  return (
    <button onClick={() => actorRef.send({ type: 'increment' })}>
      {count}
    </button>
  );
}
```

Each provider creates one actor for its subtree.

Use a provider for a cart shared by several checkout components or a session actor shared by one application shell. Put the provider close enough that separate application instances do not share an actor by accident.
